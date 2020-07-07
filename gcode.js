export const header = `
M140 S60  ; Set bed temperature
M105
M190 S60  ; Wait for bed temp
M104 S210 ; Set hotend temp
M105
M109 S210 ; Wait for hotend

; Ender 3 Custom Start G-code
G28 ; Home all axes
G92 E0 ; Reset Extruder
G1 Z2.0 F3000 ; Move Z Axis up little to prevent scratching of Heat Bed
G1 X0.1 Y20 Z0.3 F5000.0 ; Move to start position
G1 X0.1 Y200.0 Z0.3 F1500.0 E15 ; Draw the first line
G1 X0.4 Y200.0 Z0.3 F5000.0 ; Move to side a little
G1 X0.4 Y20 Z0.3 F1500.0 E30 ; Draw the second line
G92 E0 ; Reset Extruder
G1 Z2.0 F3000 ; Move Z Axis up little to prevent scratching of Heat Bed

; End of custom start GCode
M83 ; relative extrusion mode
G1 F2400 E-5
M106 S255 ; fan on
M204 S500 ; acceleration
M205 X20 Y20 ; jerk

; Now goto start point and then run G1 F2400 E5 to get extruder back to 0
`;

export const footer = `
M140 S0
M204 S4000
M107 ; fan off

; Ender 3 Custom End G-code
G4 ; Wait
M220 S100 ; Reset Speed factor override percentage to default (100%)
M221 S100 ; Reset Extrude factor override percentage to default (100%)
G91 ; Set coordinates to relative
G1 F1800 E-3 ; Retract filament 3 mm to prevent oozing
G1 F3000 Z20 ; Move Z Axis up 20 mm to allow filament ooze freely
G90 ; Set coordinates to absolute
G1 X0 Y235 F1000 ; Move Heat Bed to the front for easy print removal
M84 ; Disable stepper motors

; End of custom end GCode
M82 ;absolute extrusion mode
M104 S0
`;

export function generateGcode(points, lineWidth, layerHeight) {

}
