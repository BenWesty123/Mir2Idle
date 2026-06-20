(function () {
  const frames = window.ARROW_DEBUG_FRAMES || [];
  if (!frames.length) {
    document.body.insertAdjacentHTML("afterbegin", '<p style="color:#f88">Missing frame data.</p>');
    return;
  }

  const base = frames.find(function (f) { return f.srcFrame === 227; }) || frames[3] || frames[0];
  const measuredDeg = [96.5, 28.1, -0.4, -22.7, -5.6, 29, 95.3, 131.8, 101.9, 52.7, -4.1, -33.1, -2.5, 31.3, 102.8, 146.8];
  const compareBaseAngleDeg = 180;

  const rawGrid = document.getElementById("rawGrid");
  for (const f of frames) {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("strong");
    title.textContent = "dir " + f.dir;
    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = "frame " + f.srcFrame;
    const img = document.createElement("img");
    img.src = f.file;
    img.width = f.w * 3;
    img.height = f.h * 3;
    img.alt = "dir " + f.dir;
    card.append(title, meta, img);
    rawGrid.appendChild(card);
  }

  const baseImg = document.getElementById("baseImg");
  const rotCanvas = document.getElementById("rotCanvas");
  const rotCtx = rotCanvas.getContext("2d");
  const baseAngleInput = document.getElementById("baseAngle");
  const travelAngleInput = document.getElementById("travelAngle");
  const baseAngleVal = document.getElementById("baseAngleVal");
  const travelAngleVal = document.getElementById("travelAngleVal");
  const compareGrid = document.getElementById("compareGrid");

  function degToRad(d) {
    return (d * Math.PI) / 180;
  }

  function drawRotatedPreview() {
    const baseAngleDeg = Number(baseAngleInput.value);
    const travelAngleDeg = Number(travelAngleInput.value);
    baseAngleVal.textContent = String(baseAngleDeg);
    travelAngleVal.textContent = String(travelAngleDeg);
    const angleRad = degToRad(travelAngleDeg) - degToRad(baseAngleDeg);
    const travelAngleRad = degToRad(travelAngleDeg);

    rotCtx.clearRect(0, 0, rotCanvas.width, rotCanvas.height);
    rotCtx.strokeStyle = "#5a5040";
    rotCtx.lineWidth = 1;
    rotCtx.beginPath();
    rotCtx.moveTo(120, 20);
    rotCtx.lineTo(120, 220);
    rotCtx.moveTo(20, 120);
    rotCtx.lineTo(220, 120);
    rotCtx.stroke();
    rotCtx.strokeStyle = "#7ec8ff";
    rotCtx.beginPath();
    rotCtx.moveTo(120, 120);
    rotCtx.lineTo(120 + Math.cos(travelAngleRad) * 90, 120 + Math.sin(travelAngleRad) * 90);
    rotCtx.stroke();

    rotCtx.save();
    rotCtx.translate(120, 120);
    rotCtx.rotate(angleRad);
    rotCtx.drawImage(baseImg, base.offsetX, base.offsetY, base.w, base.h);
    rotCtx.restore();
  }

  function bootPreview() {
    drawRotatedPreview();
    baseAngleInput.addEventListener("input", drawRotatedPreview);
    travelAngleInput.addEventListener("input", drawRotatedPreview);
  }

  if (baseImg.complete) bootPreview();
  else baseImg.addEventListener("load", bootPreview);

  for (let dir = 0; dir < frames.length; dir++) {
    const card = document.createElement("div");
    card.className = "card";
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const frame = frames[dir];
    img.src = frame.file;
    img.onload = function () {
      ctx.clearRect(0, 0, 120, 120);
      ctx.drawImage(img, 30 - frame.offsetX, 30 - frame.offsetY);

      const rot = document.createElement("canvas");
      rot.width = 120;
      rot.height = 120;
      const rctx = rot.getContext("2d");
      const travelDeg = measuredDeg[dir] ?? 0;
      const angleRad = degToRad(travelDeg) - degToRad(compareBaseAngleDeg);
      rctx.save();
      rctx.translate(60, 60);
      rctx.rotate(angleRad);
      rctx.drawImage(baseImg, base.offsetX, base.offsetY, base.w, base.h);
      rctx.restore();

      const title = document.createElement("strong");
      title.textContent = "dir " + dir;
      const crystalLabel = document.createElement("div");
      crystalLabel.className = "muted";
      crystalLabel.textContent = "Crystal sprite (tip ~" + travelDeg.toFixed(1) + " deg)";
      card.append(title, crystalLabel, canvas);
      const rotWrap = document.createElement("div");
      const rotLabel = document.createElement("div");
      rotLabel.className = "muted";
      rotLabel.textContent =
        "Rotated base @ " + travelDeg.toFixed(1) + " deg travel, base " + compareBaseAngleDeg + " deg";
      rotWrap.append(rotLabel, rot);
      card.appendChild(rotWrap);
    };
    compareGrid.appendChild(card);
  }
})();
