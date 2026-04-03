"use client"

import { useState, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
import { Header } from "@/components/header"
import { ChatPanel } from "@/components/chat-panel"
import { RideOptionsPanel } from "@/components/ride-options-panel"
import { ActiveRideTracker } from "@/components/active-ride-tracker"
import { ActivityLog } from "@/components/activity-log"
import { TelemetryConsole } from "@/components/telemetry-console"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RideAgentMessage } from "@/app/api/chat/route"
import type { Booking, RideOption } from "@/lib/types"

const PLATFORM = "uber-mock"

export default function Home() {
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null)
  const [selectedRideContext, setSelectedRideContext] = useState<{
    pickup: string
    destination: string
    rideOptions: RideOption[]
  } | null>(null)

  const [pendingBooking, setPendingBooking] = useState<{
    toolCallId: string
    rideId: string
    rideName: string
    price: number
    pickup: string
    destination: string
    eta: string
    fareId?: string
  } | null>(null)

  const [pendingCancel, setPendingCancel] = useState<{
    toolCallId: string
    bookingId: string
    rideName: string
  } | null>(null)

  const { messages, sendMessage, status, addToolOutput } =
    useChat<RideAgentMessage>({
      transport: new DefaultChatTransport({
        api: "/api/chat",
        body: { platform: PLATFORM },
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

      onToolCall({ toolCall }) {
        if (toolCall.dynamic) return

        if (toolCall.toolName === "bookRide") {
          const input = toolCall.input as {
            rideId: string
            rideName: string
            price: number
            pickup: string
            destination: string
            eta: string
            fareId?: string
          }
          setPendingBooking({ toolCallId: toolCall.toolCallId, ...input })
        }

        if (toolCall.toolName === "cancelRide") {
          const input = toolCall.input as {
            bookingId: string
            rideName: string
          }
          setPendingCancel({ toolCallId: toolCall.toolCallId, ...input })
        }
      },
    })

  // Confirm booking — calls adapter through server endpoint
  const handleConfirmBooking = useCallback(async () => {
    if (!pendingBooking) return

    const res = await fetch("/api/rides/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm",
        platform: PLATFORM,
        productId: pendingBooking.rideId,
        pickup: pendingBooking.pickup,
        destination: pendingBooking.destination,
        fareId: pendingBooking.fareId,
      }),
    })
    const bookingResult = await res.json()

    const booking: Booking = {
      id: bookingResult.tripId,
      rideName: pendingBooking.rideName,
      price: pendingBooking.price,
      pickup: pendingBooking.pickup,
      destination: pendingBooking.destination,
      driver: bookingResult.driver ?? {
        name: "Finding driver...",
        rating: 0,
        car: "Assigning vehicle",
        plate: "---",
      },
      eta: `${bookingResult.estimatedPickupMinutes} min`,
      status: "arriving",
    }

    setCurrentBooking(booking)
    setSelectedRideContext(null)

    addToolOutput({
      tool: "bookRide",
      toolCallId: pendingBooking.toolCallId,
      output: { state: "confirmed", booking },
    })

    setPendingBooking(null)
  }, [pendingBooking, addToolOutput])

  // Decline booking — log server-side, then notify LLM
  const handleDeclineBooking = useCallback(async () => {
    if (!pendingBooking) return

    await fetch("/api/rides/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "decline",
        platform: PLATFORM,
        productId: pendingBooking.rideId,
        pickup: pendingBooking.pickup,
        destination: pendingBooking.destination,
      }),
    })

    addToolOutput({
      tool: "bookRide",
      toolCallId: pendingBooking.toolCallId,
      output: {
        state: "declined",
        message: "User declined to book this ride.",
      },
    })

    setPendingBooking(null)
  }, [pendingBooking, addToolOutput])

  // Confirm cancellation — calls adapter through server endpoint
  const handleConfirmCancel = useCallback(async () => {
    if (!pendingCancel) return

    const res = await fetch("/api/rides/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm",
        platform: PLATFORM,
        tripId: pendingCancel.bookingId,
      }),
    })
    const cancelResult = await res.json()

    setCurrentBooking(null)

    const feeMessage = cancelResult.cancellationFee
      ? `A cancellation fee of $${cancelResult.cancellationFee.toFixed(2)} has been charged.`
      : "No cancellation fee was charged."

    addToolOutput({
      tool: "cancelRide",
      toolCallId: pendingCancel.toolCallId,
      output: {
        state: "cancelled",
        bookingId: pendingCancel.bookingId,
        message: `Your ride has been cancelled. ${feeMessage}`,
      },
    })

    setPendingCancel(null)
  }, [pendingCancel, addToolOutput])

  // Decline cancellation — log server-side, then notify LLM
  const handleDeclineCancel = useCallback(async () => {
    if (!pendingCancel) return

    await fetch("/api/rides/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "decline",
        platform: PLATFORM,
        tripId: pendingCancel.bookingId,
      }),
    })

    addToolOutput({
      tool: "cancelRide",
      toolCallId: pendingCancel.toolCallId,
      output: { state: "kept", message: "Ride was not cancelled." },
    })

    setPendingCancel(null)
  }, [pendingCancel, addToolOutput])

  // Extract the latest ride data from tool outputs
  const latestRideData = extractLatestRideData(messages)

  // Update selected ride context for the panel
  if (
    latestRideData.rideSearch &&
    (!selectedRideContext ||
      selectedRideContext.destination !== latestRideData.rideSearch.destination)
  ) {
    setSelectedRideContext(latestRideData.rideSearch)
  }

  const handleCancelRide = () => {
    if (currentBooking) {
      sendMessage({ text: `Cancel my ride ${currentBooking.id}` })
    }
  }

  const handleSelectRide = (rideId: string) => {
    if (selectedRideContext) {
      sendMessage({
        text: `Book the ${rideId} option from ${selectedRideContext.pickup} to ${selectedRideContext.destination}`,
      })
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />
      <main className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <ChatPanel
          messages={messages}
          onSendMessage={(text) => sendMessage({ text })}
          status={status}
          pendingBooking={pendingBooking}
          pendingCancel={pendingCancel}
          onConfirmBooking={handleConfirmBooking}
          onDeclineBooking={handleDeclineBooking}
          onConfirmCancel={handleConfirmCancel}
          onDeclineCancel={handleDeclineCancel}
        />
        <div className="hidden w-[480px] shrink-0 border-l border-border bg-card lg:flex lg:flex-col">
          <Tabs defaultValue="rides" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-4 mt-3 shrink-0">
              <TabsTrigger value="rides">Rides</TabsTrigger>
              <TabsTrigger value="log">Activity Log</TabsTrigger>
            </TabsList>
            <TabsContent value="rides" className="flex-1 overflow-hidden">
              {currentBooking ? (
                <ActiveRideTracker
                  booking={currentBooking}
                  onCancel={handleCancelRide}
                />
              ) : (
                <RideOptionsPanel
                  rideContext={selectedRideContext}
                  onSelectRide={handleSelectRide}
                  messages={messages}
                />
              )}
            </TabsContent>
            <TabsContent value="log" className="flex-1 overflow-hidden">
              <ActivityLog />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <TelemetryConsole />
    </div>
  )
}

function extractLatestRideData(messages: RideAgentMessage[]) {
  let rideSearch: {
    pickup: string
    destination: string
    rideOptions: RideOption[]
  } | null = null

  for (const message of messages) {
    if (message.role !== "assistant") continue

    for (const part of message.parts) {
      if (
        part.type === "tool-searchRides" &&
        part.state === "output-available"
      ) {
        const output = part.output as {
          state: string
          pickup?: string
          destination?: string
          rideOptions?: RideOption[]
        }
        if (output.state === "ready" && output.rideOptions) {
          rideSearch = {
            pickup: output.pickup || "Current Location",
            destination: output.destination || "",
            rideOptions: output.rideOptions,
          }
        }
      }
    }
  }

  return { rideSearch }
}
