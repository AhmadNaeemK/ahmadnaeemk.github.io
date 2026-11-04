const LABEL_MAX_LENGTH = 30;
const LINE_MAX_LENGTH = 200;

// Stops at the first colon, so a value can hold colons. The required space keeps
// a URL or a time like 12:30 from becoming a label. Lines arrive trimmed, so
// whatever either side matches includes real text.
const LABELLED_LINE = /^([^:]+):\s+(.+)$/;

function parseLine(line: string, lineNumber: number) {
  if (line.length > LINE_MAX_LENGTH) {
    throw new Error(
      `Line ${lineNumber} is ${line.length} characters long; "Right now" lines can be at most ${LINE_MAX_LENGTH}.`,
    );
  }
  const parts = LABELLED_LINE.exec(line);
  if (!parts) return { value: line };
  const label = parts[1].trim();
  return label.length > LABEL_MAX_LENGTH
    ? { value: line }
    : { label, value: parts[2].trim() };
}

/** Reads the "Right now" items, in file order, from the plain text format of `now.txt`. */
export function parseNowText(text: string) {
  return text.split(/\r?\n/).flatMap((rawLine, index) => {
    const line = rawLine.trim();
    return line === "" || line.startsWith("#")
      ? []
      : [parseLine(line, index + 1)];
  });
}

/** The file's single `current` entry, in the shape `nowSchema` validates. */
export function parseNowFile(text: string) {
  return { current: { items: parseNowText(text) } };
}
