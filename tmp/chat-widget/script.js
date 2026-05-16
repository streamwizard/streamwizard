const MAX_MESSAGES = 20;
const FADE_AFTER_MS = 8000;

function usernameColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 65%)`;
}

function addMessage(name, text) {
  const chat = document.getElementById('chat');

  const el = document.createElement('div');
  el.className = 'message';

  const username = document.createElement('span');
  username.className = 'username';
  username.style.color = usernameColor(name);
  username.textContent = name + ':';

  const message = document.createElement('span');
  message.className = 'text';
  message.textContent = text;

  el.appendChild(username);
  el.appendChild(message);
  chat.prepend(el);

  gsap.to(el, { opacity: 1, duration: 0.3, ease: 'power2.out' });

  gsap.to(el, {
    opacity: 0,
    duration: 0.5,
    delay: FADE_AFTER_MS / 1000,
    ease: 'power2.in',
    onComplete: () => el.remove(),
  });

  const messages = chat.querySelectorAll('.message');
  if (messages.length > MAX_MESSAGES) {
    messages[messages.length - 1].remove();
  }
}

addEventListener('onEventReceived', (obj) => {
  const { listener, event } = obj.detail;

  if (listener === 'channel.chat.message') {
    addMessage(event.chatter_user_name, event.message.text);
  }
});
