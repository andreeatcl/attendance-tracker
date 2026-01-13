import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
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

  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef(null);
  const scannerControlsRef = useRef(null);

  const scanner = useMemo(() => new BrowserQRCodeReader(), []);

  function stopScanner() {
    try {
      scannerControlsRef.current?.stop?.();
    } catch {
      // ignore
    }
    scannerControlsRef.current = null;
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  async function lookupByCode(codeValue) {
    setEvent(null);

    const trimmed = String(codeValue || "")
      .trim()
      .toUpperCase();
    if (!trimmed) return;

    try {
      const data = await eventService.getEventByCode(trimmed);
      setEvent(data.event);
      showToast("Event loaded", "success");
    } catch {
      showToast("Lookup failed", "error");
    }
  }

  async function lookup() {
    await lookupByCode(code);
  }

  async function checkIn() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    try {
      const data = await attendanceService.checkIn(trimmed);
      showToast(data.message || "Checked in", "success");
      await lookup();
    } catch {
      showToast("Check-in failed", "error");
    }
  }

  const displayName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");

  async function startScan() {
    if (isScanning) return;
    setEvent(null);
    setIsScanning(true);

    try {
      stopScanner();

      const videoEl = videoRef.current;
      if (!videoEl) {
        showToast("Scanner not ready", "error");
        setIsScanning(false);
        return;
      }

      const controls = await scanner.decodeFromVideoDevice(
        undefined,
        videoEl,
        async (result) => {
          if (!result) return;
          const text = String(result.getText?.() ?? "")
            .trim()
            .toUpperCase();
          if (!text) return;

          stopScanner();
          setIsScanning(false);
          setCode(text);
          await lookupByCode(text);
        }
      );

      scannerControlsRef.current = controls;
    } catch {
      stopScanner();
      setIsScanning(false);
      showToast(
        "Camera access failed (try HTTPS or allow permissions)",
        "error"
      );
    }
  }

  function cancelScan() {
    stopScanner();
    setIsScanning(false);
  }

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
                disabled={isScanning}
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
              <Button type="button" onClick={startScan} disabled={isScanning}>
                Scan QR code
              </Button>
              {isScanning ? (
                <Button type="button" variant="danger" onClick={cancelScan}>
                  Cancel
                </Button>
              ) : null}
            </div>

            {isScanning ? (
              <div className="event-preview">
                <div className="muted" style={{ marginBottom: 8 }}>
                  Point your camera at the QR code.
                </div>
                <video
                  ref={videoRef}
                  style={{ width: "100%", borderRadius: 12 }}
                  muted
                  playsInline
                />
              </div>
            ) : null}

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
