import { useEffect, useMemo, useState } from "react";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  formatDate,
  formatDateTime,
  formatTime,
  toDateOnlyString,
} from "../utils/format";
import * as groupService from "../services/groupService";
import * as eventService from "../services/eventService";
import TrashIcon from "../components/icons/TrashIcon";

export default function OrganizerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const STANDALONE_GROUP_KEY = "__standalone__";

  const [showQr, setShowQr] = useState(false);

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(STANDALONE_GROUP_KEY);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendance, setAttendance] = useState([]);

  const [groupName, setGroupName] = useState("");
  const [groupRecurrence, setGroupRecurrence] = useState("WEEKLY");
  const [groupStartDate, setGroupStartDate] = useState(() => {
    return toDateOnlyString(new Date());
  });
  const [groupTime, setGroupTime] = useState("09:00");
  const [groupDuration, setGroupDuration] = useState("60");
  const [groupDefaultEventName, setGroupDefaultEventName] = useState("");

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventDuration, setEventDuration] = useState("60");

  async function refreshGroups() {
    const data = await groupService.listGroups();
    setGroups(data.groups || []);
  }

  async function refreshEvents(groupIdOrKey) {
    if (groupIdOrKey === STANDALONE_GROUP_KEY) {
      const data = await eventService.listStandaloneEvents();
      const nextEvents = data.events || [];
      setEvents(nextEvents);
      return nextEvents;
    }

    const data = await groupService.listGroupEvents(groupIdOrKey);
    const nextEvents = data.events || [];
    setEvents(nextEvents);
    return nextEvents;
  }

  async function refreshAttendance(eventId) {
    const data = await eventService.listAttendance(eventId);
    setAttendance(data.attendances || []);
  }

  useEffect(() => {
    refreshGroups().catch(() => showToast("Failed to load groups", "error"));
  }, []);

  useEffect(() => {
    setEvents([]);
    setSelectedEventId("");
    setAttendance([]);
    if (!selectedGroupId) return;
    let cancelled = false;
    (async () => {
      try {
        const nextEvents = await refreshEvents(selectedGroupId);
        if (cancelled) return;
        if (nextEvents && nextEvents.length) {
          setSelectedEventId(String(nextEvents[0].id));
        }
      } catch (e) {
        if (cancelled) return;
        showToast("Failed to load events", "error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  useEffect(() => {
    setAttendance([]);
    if (!selectedEventId) return;
    refreshAttendance(selectedEventId).catch(() =>
      showToast("Failed to load attendance", "error")
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

  const selectedEventIsOpen = Boolean(selectedEvent?.isOpen);

  function formatRecurrenceLabel(value) {
    const v = String(value || "").toUpperCase();
    if (v === "DAILY") return "Daily";
    if (v === "WEEKDAY") return "Every weekday";
    if (v === "WEEKLY") return "Weekly";
    if (v === "BIWEEKLY") return "Biweekly";
    if (v === "MONTHLY") return "Monthly";
    return "—";
  }

  useEffect(() => {
    if (!selectedGroup || isStandaloneSelected) return;

    const allowed = ["DAILY", "WEEKDAY", "WEEKLY", "BIWEEKLY", "MONTHLY"];
    const rec = String(selectedGroup.recurrence || "WEEKLY").toUpperCase();
    setGroupRecurrence(allowed.includes(rec) ? rec : "WEEKLY");

    if (selectedGroup.recurrenceStartDate) {
      setGroupStartDate(String(selectedGroup.recurrenceStartDate));
    }
    if (selectedGroup.recurrenceTime) {
      setGroupTime(String(selectedGroup.recurrenceTime));
    }
    if (selectedGroup.defaultDuration) {
      setGroupDuration(String(selectedGroup.defaultDuration));
    }
    setGroupDefaultEventName(String(selectedGroup.defaultEventName || ""));
  }, [selectedGroupId, selectedGroup, isStandaloneSelected]);

  async function onCreateGroup() {
    try {
      const data = await groupService.createGroup(groupName);
      setGroupName("");
      await refreshGroups();
      if (data?.group?.id) {
        const id = String(data.group.id);
        setSelectedGroupId(id);
        const nextEvents = await refreshEvents(id);
        if (nextEvents && nextEvents.length) {
          setSelectedEventId(String(nextEvents[0].id));
        }
      }
      showToast("Group created", "success");
    } catch (e) {
      showToast("Failed to create group", "error");
    }
  }

  async function onCreateEvent() {
    if (!selectedGroupId) {
      showToast("Select a group or choose Standalone", "error");
      return;
    }

    if (!isStandaloneSelected) {
      showToast("Set the group's schedule for recurring events", "error");
      return;
    }

    const trimmedName = eventName.trim();
    if (!trimmedName) {
      showToast("Event name is required", "error");
      return;
    }

    const startTime = eventDate && eventTime ? `${eventDate} ${eventTime}` : "";
    if (!startTime) {
      showToast("Pick a date and time", "error");
      return;
    }

    try {
      await eventService.createStandaloneEvent(
        trimmedName,
        startTime,
        Number(eventDuration)
      );
      setEventName("");
      setEventDate("");
      setEventTime("");
      await refreshEvents(selectedGroupId);
      showToast("Event created", "success");
    } catch (e) {
      showToast("Failed to create event", "error");
    }
  }

  async function onSaveGroupSchedule() {
    if (!selectedGroupId || isStandaloneSelected) {
      showToast("Select a group first", "error");
      return;
    }

    if (!groupStartDate || !groupTime || !groupDuration) {
      showToast("Fill in start date, time and duration", "error");
      return;
    }

    try {
      await groupService.updateGroupSettings(selectedGroupId, {
        recurrence: groupRecurrence,
        recurrenceStartDate: groupStartDate,
        recurrenceTime: groupTime,
        defaultDuration: Number(groupDuration),
        defaultEventName: groupDefaultEventName,
      });
      await refreshGroups();
      const nextEvents = await refreshEvents(selectedGroupId);
      if (nextEvents && nextEvents.length) {
        setSelectedEventId(String(nextEvents[0].id));
      }
      showToast("Schedule saved", "success");
    } catch (e) {
      showToast("Failed to save schedule", "error");
    }
  }

  async function onDeleteSelectedEvent() {
    if (!selectedEvent) return;

    const ok = window.confirm("Delete this event?");
    if (!ok) return;

    try {
      await eventService.deleteEvent(selectedEvent.id);

      const nextEvents = await refreshEvents(selectedGroupId);
      setAttendance([]);
      if (nextEvents && nextEvents.length) {
        setSelectedEventId(String(nextEvents[0].id));
      } else {
        setSelectedEventId("");
      }

      showToast("Event deleted", "success");
    } catch (e) {
      showToast("Failed to delete event", "error");
    }
  }

  async function onDeleteSelectedGroup() {
    if (!selectedGroup || isStandaloneSelected) return;

    const ok = window.confirm(
      "Delete this event group and all events inside it?"
    );
    if (!ok) return;

    try {
      await groupService.deleteGroup(selectedGroup.id);

      await refreshGroups();
      setSelectedGroupId(STANDALONE_GROUP_KEY);
      setEvents([]);
      setSelectedEventId("");
      setAttendance([]);

      showToast("Event group deleted", "success");
    } catch (e) {
      showToast("Failed to delete group", "error");
    }
  }

  async function onRefreshAttendance() {
    if (!selectedEventId) return;
    try {
      await refreshAttendance(selectedEventId);
      showToast("Attendance refreshed", "info");
    } catch (e) {
      showToast("Failed to refresh attendance", "error");
    }
  }

  async function onRefreshLiveSession() {
    if (!selectedGroupId) return;
    try {
      const nextEvents = await refreshEvents(selectedGroupId);
      if (selectedEventId) {
        const stillExists = (nextEvents || []).some(
          (ev) => String(ev.id) === String(selectedEventId)
        );
        if (!stillExists) {
          setSelectedEventId(
            nextEvents && nextEvents.length ? String(nextEvents[0].id) : ""
          );
        }
      }
      showToast("Session refreshed", "info");
    } catch (e) {
      showToast("Failed to refresh session", "error");
    }
  }

  const displayName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");

  async function handleExportGroupCSV() {
    if (!selectedGroupId || selectedGroupId === STANDALONE_GROUP_KEY) return;
    try {
      const blob = await groupService.exportGroupCSV(selectedGroupId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `group_${selectedGroupId}_participants.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast("Failed to export CSV", "error");
    }
  }

  async function handleExportEventCSV() {
    if (!selectedEventId) return;
    try {
      const blob = await eventService.exportEventCSV(selectedEventId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event_${selectedEventId}_participants.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast("Failed to export CSV", "error");
    }
  }

  async function handleExportGroupXLSX() {
    if (!selectedGroupId || selectedGroupId === STANDALONE_GROUP_KEY) return;
    try {
      const blob = await groupService.exportGroupXLSX(selectedGroupId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `group_${selectedGroupId}_participants.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast("Failed to export XLSX", "error");
    }
  }

  async function handleExportEventXLSX() {
    if (!selectedEventId) return;
    try {
      const blob = await eventService.exportEventXLSX(selectedEventId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event_${selectedEventId}_participants.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast("Failed to export XLSX", "error");
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-title">Organizer</div>
        <div className="page-sub">{displayName || user?.email}</div>

        <div className="page-header page-header-split">
          <div className="card">
            <div className="card-title">Group</div>
            <div className="stack">
              <Field
                label="Select group"
                hint={
                  isStandaloneSelected
                    ? "You can create standalone events without a group."
                    : "Pick a group to manage its schedule."
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

              {selectedGroup && !isStandaloneSelected ? (
                <Field label="Group schedule">
                  <div className="stack">
                    <div
                      className="grid grid-2-responsive"
                      style={{ gap: 12, alignItems: "end" }}
                    >
                      <div>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          Recurrence
                        </div>
                        <select
                          className="input"
                          value={groupRecurrence}
                          onChange={(e) => setGroupRecurrence(e.target.value)}
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKDAY">Every weekday</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="BIWEEKLY">Biweekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>

                      <div>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          Session name (optional)
                        </div>
                        <input
                          className="input"
                          value={groupDefaultEventName}
                          onChange={(e) =>
                            setGroupDefaultEventName(e.target.value)
                          }
                          placeholder={selectedGroup?.name || "Session"}
                        />
                      </div>
                    </div>

                    <div
                      className="grid grid-3-responsive"
                      style={{ gap: 12, alignItems: "end" }}
                    >
                      <input
                        className="input"
                        type="date"
                        value={groupStartDate}
                        onChange={(e) => setGroupStartDate(e.target.value)}
                      />
                      <input
                        className="input"
                        type="time"
                        value={groupTime}
                        onChange={(e) => setGroupTime(e.target.value)}
                      />
                      <input
                        className="input"
                        value={groupDuration}
                        onChange={(e) => setGroupDuration(e.target.value)}
                        placeholder="Minutes"
                      />
                    </div>

                    <div>
                      <Button
                        variant="primary"
                        type="button"
                        onClick={onSaveGroupSchedule}
                        disabled={
                          !groupStartDate || !groupTime || !groupDuration
                        }
                      >
                        Save schedule
                      </Button>
                    </div>
                  </div>
                </Field>
              ) : (
                <Field label="Create new group">
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
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Events</div>
            <div className="muted" style={{ marginBottom: 10 }}>
              {isStandaloneSelected ? (
                "Creating standalone events"
              ) : selectedGroup ? (
                <span>
                  Recurring: <strong>{selectedGroup.name}</strong> ·{" "}
                  {formatRecurrenceLabel(selectedGroup.recurrence)}
                </span>
              ) : (
                "Select a group (or standalone) above to view and create events"
              )}
            </div>

            <div className="stack">
              {!isStandaloneSelected && selectedGroup ? (
                <div
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="muted">
                    Export attendance for event group:
                  </div>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <Button className="btn-colored" type="button" onClick={handleExportGroupCSV}>
                      CSV
                    </Button>
                    <Button className="btn-colored" type="button" onClick={handleExportGroupXLSX}>
                      XLSX
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="btn-icon"
                      onClick={onDeleteSelectedGroup}
                      title="Delete event group"
                      aria-label="Delete event group"
                    >
                      <TrashIcon className="btn-icon-svg" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {isStandaloneSelected ? (
                <Field
                  label="Pick a name, date, time and duration (minutes) for the event."
                  hint=""
                >
                  <div className="stack">
                    <input
                      className="input"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="Event name"
                      disabled={!isStandaloneSelected}
                    />
                    <div
                      className="grid grid-3-responsive"
                      style={{ gap: 12, alignItems: "end" }}
                    >
                      <input
                        className="input"
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        disabled={!isStandaloneSelected}
                      />
                      <input
                        className="input"
                        type="time"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        disabled={!isStandaloneSelected}
                      />
                      <input
                        className="input"
                        value={eventDuration}
                        onChange={(e) => setEventDuration(e.target.value)}
                        placeholder="Minutes"
                        disabled={!isStandaloneSelected}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Button
                      variant="primary"
                      type="button"
                      onClick={onCreateEvent}
                      disabled={
                        !isStandaloneSelected ||
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
              ) : (
                <div className="muted">
                  This group is recurring. Events are generated automatically
                  from the group schedule.
                </div>
              )}

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
                      {ev.name || "Untitled"} - {formatDate(ev.startTime)} -{" "}
                      {formatTime(ev.startTime)}
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
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    className={`pill ${
                      selectedEventIsOpen ? "pill-success" : "pill-danger"
                    }`}
                    style={{ textTransform: "uppercase" }}
                  >
                    {selectedEventIsOpen ? "EVENT OPEN" : "EVENT CLOSED"}
                  </span>
                  <Button
                    className="nav-logout"
                    type="button"
                    onClick={onRefreshLiveSession}
                  >
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="btn-icon"
                    onClick={onDeleteSelectedEvent}
                    title="Delete event"
                    aria-label="Delete event"
                  >
                    <TrashIcon className="btn-icon-svg" />
                  </Button>
                </div>
              </div>
              <div className="code-box">{selectedEvent.accessCode}</div>
              <div className="row" style={{ marginTop: 12 }}>
                <Button
                  className="nav-logout"
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  disabled={!selectedEvent.qrCode}
                >
                  {showQr ? "Hide QR" : "Show QR"}
                </Button>
              </div>
              {showQr && selectedEvent.qrCode && (
                <div style={{ margin: '16px 0', textAlign: 'center' }}>
                  <img
                    src={selectedEvent.qrCode}
                    alt="QR code for event access"
                    style={{ width: 180, height: 180 }}
                  />
                  <div className="muted" style={{ marginTop: 4 }}>
                    Scan for access code
                  </div>
                </div>
              )}
              <div className="muted">
                Start: {formatDateTime(selectedEvent.startTime)} · Duration: {selectedEvent.duration} min
              </div>
            </div>

            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Attendance
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="muted">Export attendance for event:</span>
                  <Button className="btn-colored" type="button" onClick={handleExportEventCSV}>
                    CSV
                  </Button>
                  <Button className="btn-colored" type="button" onClick={handleExportEventXLSX}>
                    XLSX
                  </Button>
                  <Button
                    className="nav-logout"
                    type="button"
                    onClick={onRefreshAttendance}
                  >
                    Refresh
                  </Button>
                </div>
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
