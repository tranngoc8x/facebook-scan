#!/bin/bash

# Khoi dong Xvfb (virtual display)
export DISPLAY=:99
Xvfb :99 -screen 0 1280x800x24 -ac &
sleep 1

# Khoi dong fluxbox (window manager - can thiet de browser hien thi dung)
fluxbox &
sleep 1

# Khoi dong x11vnc (VNC server)
# Chay trong vong lap de tu restart neu tool bi crash khi user reload/disconnect noVNC
(while true; do x11vnc -display :99 -nopw -forever -shared -rfbport 5900; sleep 1; done) &
sleep 1

# Khoi dong noVNC (web-based VNC viewer)
/usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 &
sleep 1

echo "[VNC] noVNC ready at http://localhost:6080"
echo "[VNC] Display: $DISPLAY"

# Khoi dong Node app
exec npm run dev
