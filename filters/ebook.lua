local diagram_mode = 'text'

local function contains_box_drawing(text)
  for _, codepoint in utf8.codes(text) do
    if codepoint >= 0x2500 and codepoint <= 0x257F then return true end
  end
  return false
end

local function escape_xml(text)
  return text:gsub('&', '&amp;'):gsub('<', '&lt;'):gsub('>', '&gt;')
end

local function svg_diagram(text)
  local lines = {}
  local max_chars = 0
  for line in (text .. '\n'):gmatch('(.-)\n') do
    table.insert(lines, line)
    local n = utf8.len(line) or #line
    if n > max_chars then max_chars = n end
  end
  local cell, line_height, font_size = 6, 14, 10
  local width = math.max(1, max_chars * cell)
  local height = math.max(1, #lines * line_height + 4)
  local out = {
    '<svg class="text-diagram-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Unicode text diagram" viewBox="0 0 ' .. width .. ' ' .. height .. '">',
    '<g font-family="IBM Plex Mono Ebook, monospace" font-size="' .. font_size .. '">'
  }
  for i, line in ipairs(lines) do
    local chars = utf8.len(line) or #line
    local target = math.max(1, chars * cell)
    table.insert(out, '<text xml:space="preserve" x="0" y="' .. (i * line_height) .. '" textLength="' .. target .. '" lengthAdjust="spacingAndGlyphs">' .. escape_xml(line) .. '</text>')
  end
  table.insert(out, '</g></svg>')
  return pandoc.RawBlock('html', table.concat(out, ''))
end


local function matrix_label(text)
  return pandoc.Para({pandoc.Strong({pandoc.Str(text)})})
end

local function raw_pre(text, classes, sentinel)
  local prefix = sentinel and '<span class="matrix-sentinel">&#8288;</span>' or ''
  return pandoc.RawBlock('html', '<pre class="text-diagram ' .. classes .. '"><code>' .. prefix .. escape_xml(text) .. '</code></pre>')
end

local function framed_pre(text, tiny_indent, sentinel)
  local indent_class = tiny_indent and ' matrix-tiny-indent' or ''
  local prefix = sentinel and '<span class="matrix-sentinel">&#8288;</span>' or ''
  return pandoc.RawBlock('html',
    '<div class="text-diagram-frame"><pre class="text-diagram matrix-inner' .. indent_class .. '"><code>' ..
    prefix .. escape_xml(text) .. '</code></pre></div>')
end

local function row_diagram(text)
  local rows = {}
  for line in (text .. '\n'):gmatch('(.-)\n') do
    local escaped = escape_xml(line):gsub(' ', '&#160;')
    table.insert(rows, '<div class="text-diagram-row">' .. escaped .. '</div>')
  end
  return pandoc.RawBlock('html', '<div class="text-diagram-rows">' .. table.concat(rows, '') .. '</div>')
end

local function matrix_diagram(text)
  local baseline = pandoc.CodeBlock(text)
  baseline.classes:insert('text-diagram')
  baseline.classes:insert('matrix-baseline')

  return {
    matrix_label('A — current production pre/code'),
    baseline,
    matrix_label('B — pre/code with zero horizontal margin and padding'),
    raw_pre(text, 'matrix-zero-geometry', false),
    matrix_label('C — zero horizontal geometry + text-indent: 0.01em'),
    raw_pre(text, 'matrix-zero-geometry matrix-tiny-indent', false),
    matrix_label('D — visual padding on wrapper; inner pre/code has zero geometry'),
    framed_pre(text, false, false),
    matrix_label('E — wrapper padding + inner text-indent: 0.01em'),
    framed_pre(text, true, false),
    matrix_label('F — wrapper padding + zero-width non-whitespace sentinel before first text node'),
    framed_pre(text, false, true),
    matrix_label('G — one fixed-width block per source row; spaces encoded as NBSP'),
    row_diagram(text),
    matrix_label('H — SVG control'),
    svg_diagram(text),
  }
end

local function slug(value)
  local result = value:gsub('^/learn/?', '')
  result = result:gsub('^#+', '')
  result = result:lower():gsub('[^a-z0-9]+', '-')
  result = result:gsub('^-+', ''):gsub('-+$', '')
  if result == '' then return 'learn' end
  return result
end

local function split_fragment(target)
  local hash = target:find('#', 1, true)
  if not hash then return target, nil end
  return target:sub(1, hash - 1), target:sub(hash + 1)
end

local function normalize_route(route)
  local pieces = {}
  for piece in route:gmatch('[^/]+') do
    if piece == '..' then
      table.remove(pieces)
    elseif piece ~= '.' and piece ~= '' then
      table.insert(pieces, piece)
    end
  end
  return '/' .. table.concat(pieces, '/')
end

local function route_dir(route)
  return route:match('^(.*)/[^/]+$') or route
end

local function is_external(target)
  return target:match('^[a-zA-Z][a-zA-Z0-9+.-]*:') ~= nil or target:sub(1, 2) == '//'
end

local function rewrite_link(target, current_route, page_prefix)
  if target:sub(1, 1) == '#' then
    local fragment = target:sub(2)
    return '#' .. page_prefix .. '-' .. fragment
  end
  if is_external(target) then
    local node_prefix = 'https://nodejs.org/learn/'
    if target:sub(1, #node_prefix) ~= node_prefix then return target end
    target = '/learn/' .. target:sub(#node_prefix + 1)
  end

  local target_path, fragment = split_fragment(target)
  local route
  if target_path:sub(1, 7) == '/learn/' or target_path == '/learn' then
    route = target_path:gsub('/+$', '')
  elseif target_path:sub(1, 1) == '/' then
    return 'https://nodejs.org' .. target
  elseif target_path ~= '' then
    route = normalize_route(route_dir(current_route) .. '/' .. target_path)
    route = route:gsub('%.md$', ''):gsub('/index$', ''):gsub('/+$', '')
  else
    route = current_route
  end

  if route:sub(1, 6) ~= '/learn' then return target end
  if fragment and fragment ~= '' then return '#' .. slug(route) .. '-' .. fragment end
  return '#page-' .. slug(route)
end

local function rewrite_image(target, source_dir)
  if is_external(target) then return target end
  if target:sub(1, 1) == '/' then return 'https://nodejs.org' .. target end
  local path_part, fragment = split_fragment(target)
  local resolved = normalize_route('/' .. source_dir .. '/' .. path_part):sub(2)
  if fragment and fragment ~= '' then return resolved .. '#' .. fragment end
  return resolved
end

local function process_div(el)
  if not el.classes:includes('book-page') then return nil end
  local route = el.attributes['route'] or '/learn'
  local page_prefix = el.attributes['page-prefix'] or slug(route)
  local source_dir = el.attributes['source-dir'] or 'pages'
  local first_h1 = true

  el.content = el.content:walk({
    Header = function(header)
      if first_h1 and header.level == 1 then
        first_h1 = false
        return {}
      end
      first_h1 = false
      header.level = math.min(6, header.level + 1)
      if header.identifier ~= '' then header.identifier = page_prefix .. '-' .. header.identifier end
      return header
    end,
    Link = function(link)
      link.target = rewrite_link(link.target, route, page_prefix)
      return link
    end,
    Image = function(image)
      image.src = rewrite_image(image.src, source_dir)
      return image
    end,
    CodeBlock = function(code)
      if not contains_box_drawing(code.text) then return code end
      if diagram_mode == 'svg' then
        return {
          pandoc.Para({pandoc.Str('')}),
          svg_diagram(code.text)
        }
      end
      if diagram_mode == 'matrix' and code.text:find('pending callbacks', 1, true) then
        return matrix_diagram(code.text)
      end
      code.classes:insert('text-diagram')
      return code
    end,
  })

  return el.content
end


function Pandoc(doc)
  if doc.meta['diagram-mode'] then
    diagram_mode = pandoc.utils.stringify(doc.meta['diagram-mode'])
  end
  doc.blocks = doc.blocks:walk({Div = process_div})
  return doc
end
