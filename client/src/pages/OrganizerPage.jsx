import { useEffect, useMemo, useState } from "react";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatDateTime } from "../utils/format";
import * as groupService from "../services/groupService";
import * as eventService from "../services/eventService";

export default function OrganizerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const STANDALONE_GROUP_KEY = "__standalone__";

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(STANDALONE_GROUP_KEY);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendance, setAttendance] = useState([]);

  const [groupName, setGroupName] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventDuration, setEventDuration] = useState("60");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function refreshGroups() {
    const data = await groupService.listGroups();
    setGroups(data.groups || []);
  }

  async function refreshEvents(groupIdOrKey) {
    if (groupIdOrKey === STANDALONE_GROUP_KEY) {
      const data = await eventService.listStandaloneEvents();
      setEvents(data.events || []);
      return;
    }

    const data = await groupService.listGroupEvents(groupIdOrKey);
    setEvents(data.events || []);
  }

  async function refreshAttendance(eventId) {
    const data = await eventService.listAttendance(eventId);
    setAttendance(data.attendances || []);
  }

  useEffect(() => {
    refreshGroups().catch((e) =>
      setError(e?.response?.data?.message || "Failed to load groups")
    );
  }, []);

  useEffect(() => {
    setEvents([]);
    setSelectedEventId("");
    setAttendance([]);
    if (!selectedGroupId) return;
    refreshEvents(selectedGroupId).catch((e) =>
      setError(e?.response?.data?.message || "Failed to load events")
    );
  }, [selectedGroupId]);

  useEffect(() => {
    setAttendance([]);
    if (!selectedEventId) return;
    refreshAttendance(selectedEventId).catch((e) =>
      setError(e?.response?.data?.message || "Failed to load attendance")
    );
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((e) => String(e.id) === String(selectedEventId)) || null,
    [events, selectedEventId]
  );

  const selectedGroup = useMemo(
    () => groups.find((g) => String(g.id) === String(selectedGroupId)) || null,
    [groups, selectedGroupId]
  );

  const isStandaloneSelected = selectedGroupId === STANDALONE_GROUP_KEY;

  function isEventOpen(ev) {
    if (!ev) return false;
    if (typeof ev.isOpen === "boolean") return ev.isOpen;

    const start = new Date(ev.startTime);
    const durationMinutes = Number(ev.duration);
    const durationMs =
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes * 60 * 1000
        : 0;

    const startMs = start.getTime();
    const endMs = Number.isFinite(startMs) ? startMs + durationMs : NaN;
    const nowMs = Date.now();

    return Number.isFinite(startMs) && Number.isFinite(endMs) && durationMs > 0
      ? nowMs >= startMs && nowMs < endMs
      : false;
  }

  function formatDate(value) {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString();
    } catch {
      return "—";
    }
  }

  function formatTime(value) {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  }

  async function onCreateGroup() {
    setError("");
    setInfo("");
    try {
      await groupService.createGroup(groupName);
      setGroupName("");
      await refreshGroups();
      setInfo("Group created");
      showToast("Group created", "success");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create group");
      showToast("Failed to create group", "error");
    }
  }

  async function onCreateEvent() {
    setError("");
    setInfo("");
    if (!selectedGroupId) {
      setError("Select a group or choose Standalone");
      showToast("Select a group or choose Standalone", "error");
      return;
    }

    const trimmedName = eventName.trim();
    if (!trimmedName) {
      setError("Event name is required");
      showToast("Event name is required", "error");
      return;
    }

    const startTime = eventDate && eventTime ? `${eventDate} ${eventTime}` : "";
    if (!startTime) {
      setError("Pick a date and time");
      showToast("Pick a date and time", "error");
      return;
    }

    try {
      if (isStandaloneSelected) {
        await eventService.createStandaloneEvent(
          trimmedName,
          startTime,
          Number(eventDuration)
        );
      } else {
        await groupService.createGroupEvent(
          selectedGroupId,
          trimmedName,
          startTime,
          Number(eventDuration)
        );
      }
      setEventName("");
      setEventDate("");
      setEventTime("");
      await refreshEvents(selectedGroupId);
      setInfo("Event created");
      showToast("Event created", "success");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create event");
      showToast("Failed to create event", "error");
    }
  }

  async function onRefreshAttendance() {
    if (!selectedEventId) return;
    try {
      await refreshAttendance(selectedEventId);
      showToast("Attendance refreshed", "info");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to refresh attendance");
      showToast("Failed to refresh attendance", "error");
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
            <div className="page-title">Organizer</div>
            <div className="page-sub">{displayName || user?.email}</div>
          </div>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {info ? <div className="alert alert-success">{info}</div> : null}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>
            Active group
          </div>
          <Field
            label="Choose an event group"
            hint={
              groups.length
                ? "Events can be grouped or standalone."
                : "You can create standalone events without a group."
            }
          >
            <select
              className="input"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="">— Select —</option>
              <option value={STANDALONE_GROUP_KEY}>
                Standalone (no group)
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-title">Create a group</div>

            <div className="stack">
              <Field label="Group name">
                <div className="row">
                  <input
                    className="input"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name"
                  />
                  <Button
                    variant="primary"
                    type="button"
                    onClick={onCreateGroup}
                    disabled={!groupName.trim()}
                  >
                    Create
                  </Button>
                </div>
              </Field>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Events</div>
            <div className="muted" style={{ marginBottom: 10 }}>
              {isStandaloneSelected ? (
                "Creating standalone events"
              ) : selectedGroup ? (
                <span>
                  Creating events in <strong>{selectedGroup.name}</strong>
                </span>
              ) : (
                "Select a group (or Standalone) above to view and create events"
              )}
            </div>

            <div className="stack">
              <Field
                label="Create event"
                hint={
                  selectedGroup || isStandaloneSelected
                    ? "Pick a date and time (no ISO needed)."
                    : "Pick a group or Standalone first."
                }
              >
                <div className="stack">
                  <input
                    className="input"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Event name"
                    disabled={!selectedGroupId}
                  />
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: "1fr 1fr 140px", gap: 12 }}
                  >
                    <input
                      className="input"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      disabled={!selectedGroupId}
                    />
                    <input
                      className="input"
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      disabled={!selectedGroupId}
                    />
                    <input
                      className="input"
                      value={eventDuration}
                      onChange={(e) => setEventDuration(e.target.value)}
                      placeholder="Minutes"
                      disabled={!selectedGroupId}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={onCreateEvent}
                    disabled={
                      !selectedGroupId ||
                      !eventName.trim() ||
                      !eventDate ||
                      !eventTime ||
                      !eventDuration
                    }
                  >
                    Create event
                  </Button>
                </div>
              </Field>

              <Field label="Select event">
                <select
                  className="input"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  disabled={!selectedGroupId}
                >
                  <option value="">— Select —</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.id} - {ev.name || "Untitled"} -{" "}
                      {formatDate(ev.startTime)} - {formatTime(ev.startTime)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>

        {selectedEvent ? (
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card-title">Live Session</div>
              <div
                className="row"
                style={{
                  marginTop: 6,
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong>{selectedEvent.name || `#${selectedEvent.id}`}</strong>
                <span
                  className={`pill ${
                    isEventOpen(selectedEvent) ? "pill-success" : "pill-danger"
                  }`}
                  style={{ textTransform: "uppercase" }}
                >
                  {isEventOpen(selectedEvent) ? "EVENT OPEN" : "EVENT CLOSED"}
                </span>
              </div>
              <div className="code-box">{selectedEvent.accessCode}</div>
              <div className="muted">
                Start: {formatDateTime(selectedEvent.startTime)} · Duration:{" "}
                {selectedEvent.duration} min
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <Button type="button">Show QR</Button>
              </div>
            </div>

            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Attendance
                </div>
                <Button type="button" onClick={onRefreshAttendance}>
                  Refresh
                </Button>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {attendance.length} check-in(s)
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Checked in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {(() => {
                            const fullName = [
                              a.participant?.firstName,
                              a.participant?.lastName,
                            ]
                              .map((s) => String(s || "").trim())
                              .filter(Boolean)
                              .join(" ");

                            return fullName || a.participant?.email || "—";
                          })()}
                        </td>
                        <td>{formatDateTime(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
