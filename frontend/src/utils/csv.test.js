import { toCsv } from "./csv";

describe("CSV export", () => {
  test("plain values are joined with commas, rows with line breaks", () => {
    expect(toCsv(["Name", "Orders"], [["Ali", 3]])).toBe("Name,Orders\r\nAli,3");
  });

  test("commas, quotes and line breaks are quoted safely", () => {
    expect(toCsv(["A"], [['Hamra, "Bliss" St']])).toBe('A\r\n"Hamra, ""Bliss"" St"');
    expect(toCsv(["A"], [["line1\nline2"]])).toBe('A\r\n"line1\nline2"');
  });

  test("text that Excel would run as a formula is neutralised", () => {
    expect(toCsv(["A"], [["=SUM(1,2)"]])).toBe("A\r\n\"'=SUM(1,2)\"");
    expect(toCsv(["A"], [["+96170123456"]])).toBe("A\r\n'+96170123456");
  });

  test("empty values stay empty", () => {
    expect(toCsv(["A", "B"], [[null, undefined]])).toBe("A,B\r\n,");
  });
});
