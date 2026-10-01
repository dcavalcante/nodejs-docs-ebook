local function contains_box_drawing(text)
  for _, codepoint in utf8.codes(text) do
    if codepoint >= 0x2500 and codepoint <= 0x257F then
      return true
    end
  end
  return false
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

function Div(el)
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
      if contains_box_drawing(code.text) then
        code.classes:insert('text-diagram')
        -- Kindle renders the first row of preformatted box-drawing blocks one
        -- monospace cell to the left. Variant B of the on-device diagnostic
        -- confirmed that one additional ordinary ASCII space restores that
        -- row while leaving the remaining grid untouched.
        code.text = ' ' .. code.text
      end
      return code
    end,
  })

  return el.content
end
