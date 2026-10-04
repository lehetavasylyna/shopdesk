function nowText() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    " " +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds())
  );
}

function showDate(value) {
  if (!value) return "";
  const [datePart, timePart = ""] = String(value).split(" ");
  const [year, month, day] = datePart.split("-");
  if (!timePart) return day + "." + month + "." + year;
  const [hour, minute] = timePart.split(":");
  return day + "." + month + "." + year + " " + hour + ":" + minute;
}

module.exports = { nowText, showDate };
