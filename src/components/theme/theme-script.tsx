export function ThemeScript() {
  const code = `(function(){try{var k='pactset-theme-v1';var v=localStorage.getItem(k)||'system';var d=v==='dark'||(v==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.themePreference=v;document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`;
  return <script>{code}</script>;
}
