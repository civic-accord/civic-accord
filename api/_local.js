// Local meetings from a government's own public agenda system. Shared by the scheduled download (api/refresh.js) and
// Open Now (api/open.js). Nothing here is written or reworded; titles and links come straight from the agenda system.
const https = u => { const v = String(u || "").replace(/^http:\/\//i, "https://"); return /^https:\/\/[^\s"<>]+$/.test(v) ? v : null; };
// How often each government's list is refreshed by the schedule.
const LOCAL_EVERY = 3 * 3600e3, LOCAL_RETRY = 30 * 60e3;

// Upcoming public meetings from a local government's own agenda system (Legistar's public data service), next 30 days.
async function localMeetings(feed, getJSON) {
  // Dates are counted in the government's own time zone, so tonight's meetings aren't dropped early.
  const day = d => d.toLocaleDateString("en-CA", { timeZone: feed.tz || "UTC" });
  const now = new Date(), until = new Date(now.getTime() + 30 * 864e5);
  const q = `$filter=EventDate+ge+datetime'${day(now)}'+and+EventDate+le+datetime'${day(until)}'&$orderby=EventDate&$top=50`;
  const list = await getJSON(`https://webapi.legistar.com/v1/${feed.client}/events?${q}`);
  return (Array.isArray(list) ? list : []).map(e => {
    const body = String(e.EventBodyName || "Meeting").replace(/^[\s*]+/, "").replace(/\s+/g, " ").trim();
    const date = String(e.EventDate || "").slice(0, 10);
    return {
      id: `lg-${feed.client}-${e.EventId}`, level: "local", kind: "Local meeting",
      title: `${body}, ${new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
      who: feed.name, summary: [e.EventTime ? `Meets at ${e.EventTime}` : "", e.EventAgendaStatusName ? `Agenda: ${String(e.EventAgendaStatusName).toLowerCase()}` : ""].filter(Boolean).join(" · "),
      opened: null, closes: null, meets: date, read: https(e.EventAgendaFile) || https(e.EventInSiteURL) || feed.calendar,
      act: https(e.EventInSiteURL) || feed.calendar, actLabel: "Meeting page and agenda", source: `${feed.name} agendas`,
      localId: feed.id, countyId: feed.countyId || null, placeId: feed.placeId || null, townId: feed.townId || null, state: feed.state
    };
  });
}


// Which local feeds are due for a download, most out of date first. index: { feedId: { at, errAt } }.
function dueLocal(index, now, feeds) {
  return feeds.filter(f => f.system === "legistar")
    .map(f => ({ f, e: index[f.id] || {} }))
    .filter(({ e }) => !(e.errAt && now - e.errAt < LOCAL_RETRY))
    .filter(({ e }) => !e.at || now - e.at >= LOCAL_EVERY)
    .sort((a, b) => (a.e.at || 0) - (b.e.at || 0))
    .map(x => x.f);
}
module.exports = { localMeetings, dueLocal, LOCAL_EVERY, LOCAL_RETRY };
