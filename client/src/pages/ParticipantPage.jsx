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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function withComputedWindow(ev) {
    if (!ev) return ev;
    const start = new Date(ev.startTime);
    const durationMinutes = Number(ev.duration);
    const durationMs =
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes * 60 * 1000
        : 0;

    const startMs = start.getTime();
    const endMs = Number.isFinite(startMs) ? startMs + durationMs : NaN;
    const nowMs = Date.now();

    const computedIsOpen =
      Number.isFinite(startMs) && Number.isFinite(endMs) && durationMs > 0
        ? nowMs >= startMs && nowMs < endMs
        : false;

    const isOpen =
      typeof ev.isOpen === "boolean" ? ev.isOpen : Boolean(computedIsOpen);
    const status = isOpen ? "OPEN" : "CLOSED";

    return { ...ev, isOpen, status };
  }

  async function lookup() {
    setError("");
    setMessage("");
    setEvent(null);

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    try {
      const data = await eventService.getEventByCode(trimmed);
      setEvent(withComputedWindow(data.event));
      showToast("Event loaded", "success");
    } catch (e) {
      setError(e?.response?.data?.message || "Lookup failed");
      showToast("Lookup failed", "error");
    }
  }

  async function checkIn() {
    setError("");
    setMessage("");

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    try {
      const data = await attendanceService.checkIn(trimmed);
      setMessage(data.message || "Checked in");
      showToast(data.message || "Checked in", "success");
      await lookup();
    } catch (e) {
      setError(e?.response?.data?.message || "Check-in failed");
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

        {error ? <div className="alert alert-error">{error}</div> : null}
        {message ? <div className="alert alert-success">{message}</div> : null}

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
