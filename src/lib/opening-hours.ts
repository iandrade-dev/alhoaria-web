const TIME_ZONE = "America/Sao_Paulo";
const OPEN_MIN = 18 * 60 + 30;

export type OpeningStatus = {
  open: boolean;
  label: string;
};

function saoPauloClock(date: Date): { weekday: string; totalMin: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(read("hour"));
  const minute = Number(read("minute"));
  if (hour === 24) hour = 0;
  return { weekday: read("weekday"), totalMin: hour * 60 + minute };
}

/** Seg–sáb 18:30–00:00 no fuso America/Sao_Paulo. Domingo fechado o dia todo. */
export function getOpeningStatus(date = new Date()): OpeningStatus {
  const { weekday, totalMin } = saoPauloClock(date);
  if (weekday === "Sun") {
    return { open: false, label: "Abre seg 18:30" };
  }
  if (totalMin >= OPEN_MIN) {
    return { open: true, label: "Aberto agora · fecha às 00:00" };
  }
  return { open: false, label: "Abre às 18:30" };
}
