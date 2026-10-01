local function has_class(el, name)
  return el.classes:includes(name)
end

local function replace_first_indent(text, replacement)
  return text:gsub('^( +)', function(spaces)
    return string.rep(replacement, #spaces)
  end, 1)
end

function CodeBlock(code)
  if has_class(code, 'lab-extra-ascii') then
    code.text = code.text:gsub('^', ' ', 1)
  elseif has_class(code, 'lab-zwsp') then
    code.text = utf8.char(0x200B) .. code.text
  elseif has_class(code, 'lab-feff') then
    code.text = utf8.char(0xFEFF) .. code.text
  elseif has_class(code, 'lab-figure-space') then
    code.text = replace_first_indent(code.text, utf8.char(0x2007))
  elseif has_class(code, 'lab-en-space') then
    code.text = replace_first_indent(code.text, utf8.char(0x2002))
  end
  return code
end
