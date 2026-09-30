import { describe, expect, it } from "vitest";
import { transpileGML } from "./emit-shim.js";

describe("F2 built-in lowerings", () => {
  const cases: Array<[string, string]> = [
    ["x = angle_difference(a, b);", "% 360 + 540) % 360 - 180"],
    ["x = real(s);", "Number("],
    ["x = make_color_rgb(1, 2, 3);", "<< 16"],
    ["x = make_colour_rgb(1, 2, 3);", "<< 8"],
    ["x = date_current_datetime();", "25569"],
    [
      "if (keyboard_check_direct(vk_space)) x = 1;",
      "GmlActions.keyboard_check(_ctx,",
    ],
    [
      "draw_circle_color(1, 2, 3, c_red, c_blue, false);",
      "GmlActions.draw_circle_color(_ctx.drawTarget,",
    ],
    [
      "draw_rectangle_color(0, 0, 4, 4, c_red, c_red, c_red, c_red, true);",
      "GmlActions.draw_rectangle_color(_ctx.drawTarget,",
    ],
  ];
  it.each(cases)("%s", (gml, expected) => {
    const out = transpileGML(gml);
    expect(out).toContain(expected);
    expect(out).not.toContain("gmlUnknown");
  });
});
