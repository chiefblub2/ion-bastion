/** True on a device whose main pointer is a finger (phones, tablets): texts say "tap" and leave out mouse and keyboard hints. */
export const isTouch = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
