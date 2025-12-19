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

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
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

  async function refreshEvents(groupId) {
    const data = await groupService.listGroupEvents(groupId);
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
      setError("Select a group first");
      showToast("Select a group first", "error");
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
      await groupService.createGroupEvent(
        selectedGroupId,
        trimmedName,
        startTime,
        Number(eventDuration)
      );
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

  async function onSetStatus(status) {
    if (!selectedEvent) return;
    setError("");
    setInfo("");

    try {
      await eventService.setEventStatus(selectedEvent.id, status);
      await refreshEvents(selectedGroupId);
      setInfo(`Event set to ${status}`);
      showToast(`Event set to ${status}`, "success");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to update status");
      showToast("Failed to update status", "error");
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
                ? "Events are created inside the selected group."
                : "Create your first group to start adding events."
            }
          >
            <select
              className="input"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="">— Select —</option>
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
              {selectedGroup ? (
                <span>
                  Creating events in <strong>{selectedGroup.name}</strong>
                </span>
              ) : (
                "Select a group above to view and create events"
              )}
            </div>

            <div className="stack">
              <Field
                label="Create event"
                hint={
                  selectedGroup
                    ? "Pick a date and time (no ISO needed)."
                    : "Pick a group first."
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
                      {ev.name ? `${ev.name} — ` : ""}#{ev.id} — {ev.status} —{" "}
                      {ev.accessCode}
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
              {selectedEvent.name ? (
                <div style={{ marginTop: 6 }}>
                  <strong>{selectedEvent.name}</strong>
                </div>
              ) : null}
              <div className="code-box">{selectedEvent.accessCode}</div>
              <div className="muted">
                Start: {formatDateTime(selectedEvent.startTime)} · Duration:{" "}
                {selectedEvent.duration} min
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => onSetStatus("OPEN")}
                >
                  Open
                </Button>
                <Button type="button" onClick={() => onSetStatus("FUTURE")}>
                  Future
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => onSetStatus("CLOSED")}
                >
                  Close
                </Button>
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
