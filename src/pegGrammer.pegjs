document = doc:(lns / comment_line / property / glyph)+ { return doc.filter(Boolean)}

line_end "Line End" = [\n] / [\r] / ([\n] [\r])
ws = [\t ]
wss = ws+

lns = ws* line_end ws* { return null }
stp = [\n] / [\r] / ([\n] [\r]) / !.
comment_content = [^\n\r]

comment_line = "#" ws? text:$comment_content+ stp { return {type:'comment', text }}
property = key:p_key ws* p_sep ws* val:p_value { return {type: 'property', key, val} }
p_key = $[a-z.A-Z0-9-_]+
p_sep = ":"
p_value = p_single_line_value / p_multi_line_value
p_single_line_value = value:$([^.@:\n\r] comment_content*) stp { return value } 
p_multi_line_value = line_end val:p_multi_element+ {return val.join("")}

p_multi_element = ws+ line_content:$([^.@:\n\t ] comment_content* [^:\n\r \t]?) ws* le:$stp {return line_content + le}

glyph_label = cp_label / ch_label / tag_label / blank_label

blank_label = ":" ws* stp {return {type:'empty'}}

cp_label = lbl:(hex_label / oct_label / dec_label) {return {type:'codePoint', label:lbl }}

hex_label = @$("0" [xX] [0123456789ABCDEF]i+) p_sep ws* stp
oct_label = @$("0" [oO] [01234567]i+) p_sep ws* stp
dec_label = @$([0-9]+) p_sep ws* stp

ch_label = label:(uni_label / qt_label) { return {type:'character', label } }

qt_label = @$("'" $(qt_value+) "'") p_sep ws* stp
qt_value = [^\n\r'] / ("'" !":")
uni_value = $([Uu] "+" [0123456789ABCDEF]+)
uni_label =  @(uni_value |1.., ("," ws*)|)  ws* p_sep ws* stp
tag_value = [^\n\r"] / ("\"" !":" )
tag_label = "\"" label:$(tag_value+) "\"" p_sep ws* stp {return {type:'tag',label }}

empty_glyph = wss @$"-" ws* stp

glyph_line = wss @$([@.]+) ws* stp

glyph_prop = wss key:p_key ws* p_sep ws* val:p_value { return {type: 'property', key, val} }

glyph_prop_block = glyph_prop*

glyph = g_lbl:(glyph_label+) content:(empty_glyph / (glyph_line+)) prop:(ws* line_end @glyph_prop_block) ? {return {labels:g_lbl, ink:content, props:prop}}