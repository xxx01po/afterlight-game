window.renderCover = () => {
  const t = 1.6; update(t); const sh = shotAt(t); setGameCam(t, 16 / 9, 1.0); renderer.setRenderTarget(rtGame); renderer.render(scene, gameCam); renderer.setRenderTarget(null);
  sh.f(t, 0.6); renderer.render(scene, cam); ctx.drawImage(renderer.domElement, 0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const [s, y, c, sz] of [['Я ЗАБАНИЛ', 250, '#fff', 132], ['СВОЮ МАМУ', 390, '#ff3b3b', 132]]) { ctx.font = `900 ${sz}px Inter`; ctx.lineWidth = 26; ctx.strokeStyle = '#000'; ctx.strokeText(s, W / 2, y); ctx.fillStyle = c; ctx.fillText(s, W / 2, y); }
  ctx.translate(W / 2, 1480); ctx.rotate(-0.06); ctx.fillStyle = 'rgba(200,0,0,0.95)'; rr(ctx, -400, -95, 800, 190, 34); ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; rr(ctx, -400, -95, 800, 190, 34); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '900 76px Inter'; ctx.fillText('МАМА ЗАБАНЕНА', 0, -18); ctx.font = '700 40px Inter'; ctx.fillText('/ban МАМА', 0, 52);
  ctx.restore(); return out.toDataURL('image/png');
};
