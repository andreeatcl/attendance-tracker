import { useState } from "react";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatDateTime } from "../utils/format";
import * as eventService from "../services/eventService";
import * as attendanceService from "../services/attendanceService";

export default function ParticipantPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [code, setCode] = useState("");
  const [event, setEvent] = useState(null);

  async function lookup() {
    setEvent(null);

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    try {
      const data = await eventService.getEventByCode(trimmed);
      setEvent(data.event);
      showToast("Event loaded", "success");
    } catch (e) {
      showToast("Lookup failed", "error");
    }
  }

  async function checkIn() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    try {
      const data = await attendanceService.checkIn(trimmed);
      showToast(data.message || "Checked in", "success");
      await lookup();
    } catch (e) {
      showToast("Check-in failed", "error");
    }
  }

  const displayName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <div className="page-title">Participant</div>
            <div className="page-sub">{displayName || user?.email}</div>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-title">Check in</div>

          <div className="stack">
            <Field
              label="Event code"
              hint="Ask your organizer for the 6-character code."
            >
              <input
                className="input input-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ex: X9TRP2"
              />
            </Field>

            <div className="row">
              <Button type="button" onClick={lookup} disabled={!code.trim()}>
                Lookup
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={checkIn}
                disabled={!code.trim() || !event?.isOpen || event?.checkedIn}
              >
                Check in
              </Button>
            </div>

            {event ? (
              <div className="event-preview">
                <div className="muted">Event</div>
                <div className="event-line">
                  <strong>{event.name ? event.name : `#${event.id}`}</strong> ·{" "}
                  <span
                    className={`pill ${
                      event.isOpen ? "pill-success" : "pill-danger"
                    }`}
                    style={{ textTransform: "uppercase" }}
                  >
                    {event.isOpen ? "EVENT OPEN" : "EVENT CLOSED"}
                  </span>
                  {typeof event.checkedIn === "boolean" ? (
                    <span className="pill" style={{ marginLeft: 8 }}>
                      {event.checkedIn ? "Checked in" : "Not checked in"}
                    </span>
                  ) : null}
                </div>
                <div className="muted">
                  Start: {formatDateTime(event.startTime)} · Duration:{" "}
                  {event.duration} min
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
