export function money(value) {
  return Number(value).toLocaleString("en-US") + " UAH";
}

export function when(value) {
  if (!value) return "";
  const [datePart, timePart = ""] = String(value).split(" ");
  const [year, month, day] = datePart.split("-");
  if (!timePart) return day + "." + month + "." + year;
  const [hour, minute] = timePart.split(":");
  return day + "." + month + "." + year + " " + hour + ":" + minute;
}
