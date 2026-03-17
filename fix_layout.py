import sys

with open('static/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Extract the profile menu wrap
start_marker = '        <div class="profile-menu-wrap" id="profile-menu-wrap">'
end_marker = '              </button>\n            </div>\n          </div>\n        </div>\n\n      <!-- Dashboard Page -->'

s_idx = text.find(start_marker)
# Find the exact end of profile_menu_wrap
if s_idx == -1:
    print("Could not find start_marker")
    sys.exit(1)

# we just find '          </div>\n        </div>\n\n      <!-- Dashboard Page -->'
end_marker2 = '          </div>\n        </div>\n      </div>\n\n      <!-- Dashboard Page -->'
e_idx = text.find('          </div>\n        </div>\n      </div>\n\n      <!-- Dashboard Page -->')

if e_idx == -1:
    print("Could not find end_marker")
    sys.exit(1)
    
profile_menu_html = text[s_idx:e_idx + len('          </div>\n        </div>')]

# 2. Remove main-content-topbar entirely
topbar_full_start = '      <div class="main-content-topbar" aria-label="Primary actions">\n'
s2_idx = text.find(topbar_full_start)
e2_idx = text.find('      <!-- Dashboard Page -->')

if s2_idx == -1 or e2_idx == -1:
    print("Could not find topbar")
    sys.exit(1)
    
text = text[:s2_idx] + text[e2_idx:]

# 3. Add to sidebar-user-area
sidebar_target = '      <!-- User Profile (bottom of sidebar) -->\n      <div class="sidebar-user-area">\n        <button id="pwa-install-btn" class="pwa-install-btn" type="button" aria-hidden="true" title="Install FitTrack app for faster access">\n          <i class="fas fa-download"></i>\n          <span>Install App</span>\n        </button>\n'

# If that exact string isn't there, we'll try a simpler one:
fallback_target = '        <button id="pwa-install-btn" class="pwa-install-btn" type="button" aria-hidden="true" title="Install FitTrack app for faster access">\n          <i class="fas fa-download"></i>\n          <span>Install App</span>\n        </button>\n'

if fallback_target in text:
    # unindent 2 spaces
    lines = profile_menu_html.split('\n')
    indented_lines = [line[2:] if line.startswith('  ') else line for line in lines]
    adjusted_profile_html = '\n'.join(indented_lines) + '\n'
    
    # insert after the fallback target
    parts = text.split(fallback_target)
    text = parts[0] + fallback_target + adjusted_profile_html + parts[1]
    
    with open('static/index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully rearranged")
else:
    print("Could not find sidebar target")

