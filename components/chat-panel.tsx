"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import Markdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Send,
  Sparkles,
  MapPin,
  Navigation,
  Clock,
  XCircle,
  Car,
  Users,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  User,
  Zap,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { exportTranscript } from "@/lib/export-transcript"
import type { RideAgentMessage } from "@/app/api/chat/route"
import type { RideOption } from "@/lib/types"

// Extract typed tool parts from the message union
type MessagePart = RideAgentMessage["parts"][number]
type ToolPart<T extends string> = Extract<MessagePart, { type: T }>

interface ChatPanelProps {
  messages: RideAgentMessage[]
  onSendMessage: (content: string) => void
  status: "ready" | "streaming" | "submitted" | "error"
  pendingBooking: {
    toolCallId: string
    rideId: string
    rideName: string
    price: number
    pickup: string
    destination: string
    fareId?: string
  } | null
  pendingCancel: {
    toolCallId: string
    bookingId: string
  } | null
  onConfirmBooking: () => void
  onDeclineBooking: () => void
  onConfirmCancel: () => void
  onDeclineCancel: () => void
}

const suggestionChips = [
  { icon: MapPin, label: "Ride to Times Square" },
  { icon: Navigation, label: "Airport pickup" },
  { icon: Clock, label: "Schedule a ride" },
  { icon: XCircle, label: "Cancel my ride" },
]

export function ChatPanel({
  messages,
  onSendMessage,
  status,
  pendingBooking,
  pendingCancel,
  onConfirmBooking,
  onDeclineBooking,
  onConfirmCancel,
  onDeclineCancel,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status !== "ready") return
    onSendMessage(input)
    setInput("")
  }

  const handleChipClick = (label: string) => {
    if (status !== "ready") return
    onSendMessage(label)
  }

  const isLoading = status === "streaming" || status === "submitted"

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6"
      >
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Initial greeting if no messages */}
          {messages.length === 0 && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0 border border-border">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed">
                {"Hi! I'm your AI ride assistant. Where would you like to go today? Just tell me your destination, and I'll find the best options for you."}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="space-y-4">
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case "text":
                    return (
                      <div
                        key={index}
                        className={cn(
                          "flex gap-3",
                          message.role === "user" && "flex-row-reverse"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <Avatar className="h-8 w-8 shrink-0 border border-border">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              <Sparkles className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <Avatar className="h-8 w-8 shrink-0 border border-border">
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                            message.role === "assistant"
                              ? "bg-muted text-foreground"
                              : "bg-primary text-primary-foreground"
                          )}
                        >
                          {message.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <Markdown>{part.text}</Markdown>
                            </div>
                          ) : (
                            part.text
                          )}
                        </div>
                      </div>
                    )

                  case "tool-searchRides":
                    return <SearchRidesUI key={index} part={part} />

                  case "tool-bookRide":
                    return <BookRideUI key={index} part={part} />

                  case "tool-cancelRide":
                    return <CancelRideUI key={index} part={part} />

                  case "tool-trackRide":
                    return <TrackRideUI key={index} part={part} />

                  default:
                    return null
                }
              })}
            </div>
          ))}

          {/* Pending Booking Confirmation UI */}
          {pendingBooking && (
            <BookingConfirmationUI
              booking={pendingBooking}
              onConfirm={onConfirmBooking}
              onDecline={onDeclineBooking}
            />
          )}

          {/* Pending Cancel Confirmation UI */}
          {pendingCancel && (
            <CancelConfirmationUI
              cancel={pendingCancel}
              onConfirm={onConfirmCancel}
              onDecline={onDeclineCancel}
            />
          )}

          {isLoading && !pendingBooking && !pendingCancel && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0 border border-border">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3">
                <Spinner className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestionChips.map((chip) => (
                <Button
                  key={chip.label}
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full"
                  onClick={() => handleChipClick(chip.label)}
                  disabled={status !== "ready"}
                >
                  <chip.icon className="h-3.5 w-3.5" />
                  {chip.label}
                </Button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type where you want to go..."
              className="flex-1 rounded-full border-border bg-background px-4"
              disabled={status !== "ready" || !!pendingBooking || !!pendingCancel}
            />
            <Button
              type="submit"
              size="icon"
              className="shrink-0 rounded-full"
              disabled={!input.trim() || status !== "ready" || !!pendingBooking || !!pendingCancel}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={() => exportTranscript(messages)}
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Export transcript</span>
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

// Human-in-the-loop Booking Confirmation Component
function BookingConfirmationUI({
  booking,
  onConfirm,
  onDecline,
}: {
  booking: {
    rideName: string
    price: number
    pickup: string
    destination: string
  }
  onConfirm: () => void
  onDecline: () => void
}) {
  return (
    <Card className="mx-auto max-w-md overflow-hidden border-primary/20 bg-primary/5">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          <span className="font-medium">Confirm Your Booking</span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ride</span>
            <span className="font-medium">{booking.rideName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="font-bold text-lg">${booking.price.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="rounded-lg bg-muted p-3 space-y-1">
          <div className="flex items-start gap-2">
            <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pickup</p>
              <p className="text-sm">{booking.pickup}</p>
            </div>
          </div>
          <div className="ml-1 h-4 border-l border-dashed border-muted-foreground/30" />
          <div className="flex items-start gap-2">
            <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Destination</p>
              <p className="text-sm">{booking.destination}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDecline}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={onConfirm}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Confirm Booking
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Human-in-the-loop Cancel Confirmation Component
function CancelConfirmationUI({
  cancel,
  onConfirm,
  onDecline,
}: {
  cancel: {
    bookingId: string
  }
  onConfirm: () => void
  onDecline: () => void
}) {
  return (
    <Card className="mx-auto max-w-md overflow-hidden border-destructive/20 bg-destructive/5">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="font-medium">Cancel Ride?</span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Are you sure you want to cancel your ride?
          Cancellation fees may apply if the driver is already on the way.
        </p>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDecline}
          >
            Keep Ride
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Ride
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Generative UI Components for each tool

function LoadingCard({ message, sub }: { message: string; sub?: string }) {
  return (
    <Card className="mx-auto max-w-md p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{message}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

function SearchRidesUI({ part }: { part: ToolPart<"tool-searchRides"> }) {
  if (part.state === "input-streaming" || part.state === "input-available") {
    const input = part.state === "input-available" ? part.input : undefined
    return (
      <LoadingCard
        message="Searching for rides..."
        sub={input ? `${input.pickup} → ${input.destination}` : undefined}
      />
    )
  }

  if (part.state !== "output-available") return null
  const output = part.output as {
    state: string
    pickup?: string
    destination?: string
    rideOptions?: RideOption[]
    fareExpiresAt?: number
    message?: string
  }

  if (output.state === "error") {
    return (
      <Card className="mx-auto max-w-md p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">Location Not Found</p>
            <p className="text-xs text-muted-foreground">{output.message ?? "Could not find the specified location."}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (output.state === "searching") {
    return (
      <LoadingCard
        message="Finding available rides..."
        sub={output.pickup && output.destination ? `${output.pickup} → ${output.destination}` : undefined}
      />
    )
  }

  if (output.state === "ready" && output.rideOptions) {
    return (
      <Card className="mx-auto max-w-md overflow-hidden">
        {/* Route header */}
        <div className="bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center gap-2 text-xs font-medium opacity-80">
            <Navigation className="h-3.5 w-3.5" />
            <span>{output.rideOptions.length} options available</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="truncate">{output.pickup}</span>
            <span className="shrink-0 opacity-60">→</span>
            <span className="truncate font-semibold">{output.destination}</span>
          </div>
        </div>

        {/* Surge warning */}
        {output.rideOptions.some((r: { surgeMultiplier?: number }) => (r.surgeMultiplier ?? 1) > 1) && (
          <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>Surge pricing is active. Fares are higher than usual.</span>
          </div>
        )}

        {/* Ride list — fully visible, no scroll cap */}
        <div className="divide-y divide-border">
          {output.rideOptions.map((ride, i) => (
            <div
              key={ride.id}
              className={cn(
                "flex items-center gap-3 px-4 py-4",
                i === 0 && !ride.noCarsAvailable && "bg-muted/30",
                ride.noCarsAvailable && "opacity-50"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                <Car className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">{ride.name}</span>
                  {ride.noCarsAvailable ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Unavailable
                    </span>
                  ) : (
                    <>
                      {i === 0 && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                          Best value
                        </span>
                      )}
                      {ride.type === "premium" && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Premium
                        </span>
                      )}
                    </>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{ride.description}</p>
                {!ride.noCarsAvailable && (
                  <div className="mt-1.5 flex items-center gap-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {ride.eta}
                    </span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Up to {ride.capacity}
                    </span>
                    <span className="text-border">·</span>
                    <span>{ride.duration}</span>
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className={cn("text-base font-bold", ride.noCarsAvailable && "line-through text-muted-foreground")}>${ride.price.toFixed(2)}</span>
                {!ride.noCarsAvailable && (ride.surgeMultiplier ?? 1) > 1 && (
                  <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] font-medium text-amber-600">
                    <Zap className="h-3 w-3" />
                    {ride.surgeMultiplier}x surge
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {output.fareExpiresAt ? (
          <FareCountdown expiresAt={output.fareExpiresAt} />
        ) : (
          <div className="border-t border-border bg-muted/30 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              Tell me which ride you&apos;d like to book.
            </p>
          </div>
        )}
      </Card>
    )
  }

  return null
}

function BookRideUI({ part }: { part: ToolPart<"tool-bookRide"> }) {
  if (part.state === "input-streaming" || part.state === "input-available") {
    return <LoadingCard message="Waiting for your confirmation..." />
  }

  if (part.state !== "output-available") return null
  const output = part.output as {
    state: string
    booking?: { id: string; rideName: string; price: number; pickup: string; destination: string; driver: { name: string; rating: number; car: string; plate: string }; eta: string }
    message?: string
  }

  if (output.state === "error") {
    return (
      <Card className="mx-auto max-w-md p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">Booking Failed</p>
            <p className="text-xs text-muted-foreground">{output.message ?? "Something went wrong. Please try again."}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (output.state === "confirmed" && output.booking) {
    const booking = output.booking
    return (
      <Card className="mx-auto max-w-md overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <p className="font-semibold">Ride Confirmed</p>
            <p className="text-xs opacity-80">Booking #{booking.id}</p>
          </div>
          <span className="ml-auto text-xl font-bold">${booking.price.toFixed(2)}</span>
        </div>
        <div className="p-4 space-y-3">
          {/* Driver */}
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <Avatar className="h-11 w-11 border border-border">
              <AvatarFallback className="text-sm font-semibold">
                {booking.driver.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{booking.driver.name}</p>
              <p className="text-xs text-muted-foreground">{booking.driver.car} · {booking.driver.plate}</p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs">{booking.rideName}</Badge>
              <p className="mt-1 text-xs font-medium text-primary">ETA {booking.eta}</p>
            </div>
          </div>

          {/* Route */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-2.5">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pickup</p>
                <p className="text-sm">{booking.pickup}</p>
              </div>
            </div>
            <div className="ml-[5px] h-4 border-l-2 border-dashed border-muted-foreground/30" />
            <div className="flex items-start gap-2.5">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Destination</p>
                <p className="text-sm">{booking.destination}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (output.state === "declined") {
    return (
      <Card className="mx-auto max-w-md p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <XCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">Booking cancelled — no charge made.</p>
        </div>
      </Card>
    )
  }

  return null
}

function CancelRideUI({ part }: { part: ToolPart<"tool-cancelRide"> }) {
  if (part.state === "input-streaming" || part.state === "input-available") {
    return <LoadingCard message="Waiting for your confirmation..." />
  }

  if (part.state !== "output-available") return null
  const output = part.output as { state: string; message?: string }

  if (output.state === "error") {
    return (
      <Card className="mx-auto max-w-md p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">Cancellation Failed</p>
            <p className="text-xs text-muted-foreground">{output.message ?? "Could not cancel the ride."}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (output.state === "cancelled") {
    return (
      <Card className="mx-auto max-w-md p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">Ride Cancelled</p>
            <p className="text-xs text-muted-foreground">{output.message ?? "Your ride has been cancelled."}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (output.state === "kept") {
    return (
      <Card className="mx-auto max-w-md p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-medium">Your ride is still active.</p>
        </div>
      </Card>
    )
  }

  return null
}

function TrackRideUI({ part }: { part: ToolPart<"tool-trackRide"> }) {
  if (part.state === "input-streaming" || part.state === "input-available") {
    return <LoadingCard message="Getting ride status..." />
  }

  if (part.state !== "output-available") return null
  const output = part.output as {
    state: string
    status?: string
    eta?: string
    driver?: { name: string; rating: number; car: string; plate: string }
  }

  if (output.state === "loading") {
    return <LoadingCard message="Getting ride status..." />
  }

  if (output.state === "ready") {
    const statusConfig: Record<string, { label: string; color: string }> = {
      processing: { label: "Finding your driver...", color: "text-muted-foreground" },
      accepted: { label: "Driver assigned", color: "text-blue-600" },
      arriving: { label: "Driver is on the way", color: "text-blue-600" },
      in_progress: { label: "Trip in progress", color: "text-primary" },
      completed: { label: "Trip completed", color: "text-green-600" },
      rider_canceled: { label: "Ride cancelled", color: "text-destructive" },
      driver_canceled: { label: "Driver cancelled", color: "text-destructive" },
      no_drivers_available: { label: "No drivers available", color: "text-destructive" },
    }
    const config = statusConfig[output.status ?? "processing"] ?? {
      label: output.status ?? "Unknown",
      color: "text-muted-foreground",
    }

    return (
      <Card className="mx-auto max-w-md overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Navigation className="h-4 w-4" />
          </div>
          <div>
            <p className={cn("text-sm font-semibold", config.color)}>{config.label}</p>
            <p className="text-xs text-muted-foreground">{output.eta}</p>
          </div>
        </div>
        {output.driver && (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            {output.driver.name} · {output.driver.car} · {output.driver.plate}
          </div>
        )}
      </Card>
    )
  }

  return null
}

function FareCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setRemaining(secs)
      if (secs <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-2 border-t border-border bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>Prices expired. Ask for new estimates to get updated fares.</span>
      </div>
    )
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isUrgent = remaining <= 30

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs",
        isUrgent
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
          : "bg-muted/30 text-muted-foreground"
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>
        Prices valid for {mins}:{secs.toString().padStart(2, "0")}
      </span>
    </div>
  )
}
