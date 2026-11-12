/**
 * Browser stand-in for `@devvit/web/client` during local development.
 * dev/vite.config.ts aliases the real module to this file; the Devvit build
 * never sees it. The player comes from the page URL: ?user=alice or ?user=anon.
 */
const params = new URLSearchParams(location.search);
const user = params.get('user') ?? 'alice';

const realFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set('x-dev-user', user);
  return realFetch(input, { ...init, headers });
};

export const context = {
  postId: 't3_dev',
  username: user === 'anon' ? undefined : user,
  userId: user === 'anon' ? undefined : `t2_${user}`,
  subredditName: 'areyounormal',
};

const toastBox = (): HTMLElement => {
  let box = document.getElementById('dev-toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'dev-toast';
    box.setAttribute('role', 'status');
    box.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1a1a1b;color:#fff;font:500 14px system-ui;padding:10px 16px;border-radius:6px;z-index:99;max-width:90vw';
    document.body.append(box);
  }
  return box;
};

export const showToast = (toast: string | { text: string }): void => {
  const box = toastBox();
  box.textContent = typeof toast === 'string' ? toast : toast.text;
  box.style.display = 'block';
  window.setTimeout(() => {
    box.style.display = 'none';
  }, 2600);
};

export const navigateTo = (url: string | { url: string }): void => {
  window.open(typeof url === 'string' ? url : url.url, '_blank');
};

export const showLoginPrompt = (): void =>
  showToast('Reddit shows its login dialog here.');

export const requestExpandedMode = (
  _event: MouseEvent,
  entry: string
): void => {
  location.href = `/${entry}.html${location.search}`;
};

export const exitExpandedMode = (): void => {
  location.href = `/splash.html${location.search}`;
};

export const getWebViewMode = (): 'inline' | 'expanded' =>
  location.pathname.includes('splash') ? 'inline' : 'expanded';

export const connectRealtime = () => ({ disconnect: async () => undefined });
export const disconnectRealtime = (): void => undefined;

type Field = { name: string; label: string; required?: boolean };

/** A plain stand-in for Reddit's form dialog. */
export const showForm = (form: {
  title?: string;
  fields: Field[];
  acceptLabel?: string;
}): Promise<unknown> =>
  new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.style.cssText =
      'font:15px system-ui;padding:20px;border:1px solid #888;max-width:360px;width:90vw';
    const formEl = document.createElement('form');
    formEl.method = 'dialog';
    const fields = form.fields
      .map(
        (f) =>
          `<label style="display:block;margin:8px 0">${f.label}<input name="${f.name}" ${f.required ? 'required' : ''} style="display:block;width:100%;padding:6px;margin-top:4px"></label>`
      )
      .join('');
    formEl.innerHTML = `<h3 style="margin:0 0 12px">${form.title ?? ''}</h3>${fields}<menu style="display:flex;gap:8px;padding:0;margin:14px 0 0"><button value="cancel" formnovalidate>Cancel</button><button value="ok">${form.acceptLabel ?? 'OK'}</button></menu>`;
    dialog.append(formEl);
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      const values = Object.fromEntries(new FormData(formEl).entries());
      dialog.remove();
      resolve(
        dialog.returnValue === 'ok'
          ? { action: 'SUBMITTED', values }
          : { action: 'CANCELED' }
      );
    });
    dialog.showModal();
  });
