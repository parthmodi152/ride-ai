"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
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
import { TripHistory } from "@/components/trip-history"
import { TelemetryConsole } from "@/components/telemetry-console"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RideAgentMessage } from "@/app/api/chat/route"
import type { Booking, RideOption } from "@/lib/types"

const PLATFORM = "uber-mock"
const FALLBACK_LOCATION = {
  address: "Empire State Building, New York, NY",
  lat: 40.7484,
  lng: -73.9857,
}

export default function Home() {
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null)
  const [userLocation, setUserLocation] = useState(FALLBACK_LOCATION)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`)
          const data = await res.json()
          setUserLocation({ address: data.address, lat: latitude, lng: longitude })
        } catch {
          setUserLocation({ address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, lat: latitude, lng: longitude })
        }
      },
      () => {} // denied or error, keep fallback
    )
  }, [])

  const [pendingBooking, setPendingBooking] = useState<{
    toolCallId: string
    rideId: string
    rideName: string
    price: number
    pickup: string
    destination: string
    fareId?: string
  } | null>(null)

  const [pendingCancel, setPendingCancel] = useState<{
    toolCallId: string
    bookingId: string
  } | null>(null)

  const userLocationRef = useRef(userLocation)
  userLocationRef.current = userLocation

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ platform: PLATFORM, userLocation: userLocationRef.current }),
      }),
    []
  )

  const { messages, sendMessage, status, addToolOutput } =
    useChat<RideAgentMessage>({
      transport,
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
            fareId?: string
          }
          setPendingBooking({ toolCallId: toolCall.toolCallId, ...input })
        }

        if (toolCall.toolName === "cancelRide") {
          const input = toolCall.input as { bookingId: string }
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

    if (!res.ok) {
      addToolOutput({
        tool: "bookRide",
        toolCallId: pendingBooking.toolCallId,
        output: {
          state: "error",
          message: bookingResult.message ?? "Booking failed",
        },
      })
      setPendingBooking(null)
      return
    }

    const driverInfo = bookingResult.driver
    const vehicleInfo = bookingResult.vehicle

    const booking: Booking = {
      id: bookingResult.tripId,
      rideName: pendingBooking.rideName,
      price: pendingBooking.price,
      pickup: pendingBooking.pickup,
      destination: pendingBooking.destination,
      driver: {
        name: driverInfo?.name ?? "Finding driver...",
        rating: driverInfo?.rating ?? 0,
        car: vehicleInfo
          ? `${vehicleInfo.color} ${vehicleInfo.make} ${vehicleInfo.model}`
          : "Assigning vehicle",
        plate: vehicleInfo?.licensePlate ?? "---",
      },
      eta: `${bookingResult.estimatedPickupMinutes} min`,
      status: (bookingResult.status ?? "processing") as Booking["status"],
    }

    setCurrentBooking(booking)

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

    if (!res.ok) {
      addToolOutput({
        tool: "cancelRide",
        toolCallId: pendingCancel.toolCallId,
        output: {
          state: "error",
          message: cancelResult.message ?? "Cancellation failed",
        },
      })
      setPendingCancel(null)
      return
    }

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

  // Derive ride context from messages — always fresh, no stale state
  const selectedRideContext = extractLatestRideData(messages).rideSearch

  const handleCancelRide = () => {
    if (currentBooking) {
      sendMessage({
        text: `Cancel my ${currentBooking.rideName} ride (booking ID: ${currentBooking.id})`,
      })
    }
  }

  const handleSelectRide = (rideId: string, rideName: string) => {
    if (selectedRideContext) {
      const ride = selectedRideContext.rideOptions.find((r) => r.id === rideId)
      sendMessage({
        text: `Book ${rideName} (product ID: ${rideId}, fare ID: ${ride?.fareId ?? "unknown"}, price: $${ride?.price.toFixed(2) ?? "?"}) from ${selectedRideContext.pickup} to ${selectedRideContext.destination}`,
      })
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header userLocation={userLocation} />
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
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="log">Activity Log</TabsTrigger>
            </TabsList>
            <TabsContent value="rides" className="flex-1 overflow-hidden">
              {currentBooking ? (
                <ActiveRideTracker
                  booking={currentBooking}
                  platform={PLATFORM}
                  onCancel={handleCancelRide}
                  onDismiss={() => setCurrentBooking(null)}
                />
              ) : (
                <RideOptionsPanel
                  rideContext={selectedRideContext}
                  onSelectRide={handleSelectRide}
                  messages={messages}
                />
              )}
            </TabsContent>
            <TabsContent value="history" className="flex-1 overflow-hidden">
              <TripHistory />
            </TabsContent>
            <TabsContent value="log" className="flex flex-col flex-1 overflow-hidden">
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
    fareExpiresAt?: number
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
          fareExpiresAt?: number
        }
        if (output.state === "ready" && output.rideOptions) {
          rideSearch = {
            pickup: output.pickup || "Current Location",
            destination: output.destination || "",
            rideOptions: output.rideOptions,
            fareExpiresAt: output.fareExpiresAt,
          }
        }
      }
    }
  }

  return { rideSearch }
}
