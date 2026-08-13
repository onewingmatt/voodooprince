export function screenShake(intensity = 8, duration = 300) {
  const root = document.documentElement;
  const keyframes = `
    @keyframes shake-${Date.now()} {
      0%, 100% { transform: translate(0, 0); }
      10% { transform: translate(-${intensity}px, -${intensity}px); }
      20% { transform: translate(${intensity}px, ${intensity}px); }
      30% { transform: translate(-${intensity}px, ${intensity}px); }
      40% { transform: translate(${intensity}px, -${intensity}px); }
      50% { transform: translate(-${intensity}px, 0); }
      60% { transform: translate(${intensity}px, 0); }
      70% { transform: translate(-${intensity}px, ${intensity}px); }
      80% { transform: translate(${intensity}px, -${intensity}px); }
      90% { transform: translate(${intensity}px, ${intensity}px); }
    }
  `;
  const style = document.createElement('style');
  const animName = `shake-${Date.now()}`;
  style.textContent = keyframes.replace(new RegExp(`shake-${Date.now()}`, 'g'), animName);
  document.head.appendChild(style);
  root.style.animation = `${animName} ${duration}ms`;
  setTimeout(() => {
    root.style.animation = '';
    style.remove();
  }, duration);
}

export function confetti() {
  const colors = ['#c084fc', '#d9435e', '#2f6fed', '#28a35c', '#d6a419'];
  const root = document.documentElement;

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.style.position = 'fixed';
    particle.style.pointerEvents = 'none';
    particle.style.left = Math.random() * window.innerWidth + 'px';
    particle.style.top = '-10px';
    particle.style.width = (Math.random() * 8 + 4) + 'px';
    particle.style.height = particle.style.width;
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    particle.style.opacity = '1';
    particle.style.zIndex = '9999';

    const vx = (Math.random() - 0.5) * 8;
    const vy = Math.random() * 6 + 4;
    const gravity = 0.1;

    let x = parseFloat(particle.style.left);
    let y = parseFloat(particle.style.top);
    let velocityX = vx;
    let velocityY = vy;
    let opacity = 1;
    let frame = 0;
    const totalFrames = 120;

    document.body.appendChild(particle);

    const animate = () => {
      frame++;
      velocityY += gravity;
      x += velocityX;
      y += velocityY;
      opacity = 1 - (frame / totalFrames);

      particle.style.left = x + 'px';
      particle.style.top = y + 'px';
      particle.style.opacity = opacity;

      if (frame < totalFrames) {
        requestAnimationFrame(animate);
      } else {
        particle.remove();
      }
    };
    animate();
  }
}
