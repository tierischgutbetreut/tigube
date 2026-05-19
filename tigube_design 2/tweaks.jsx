// Tweaks panel for tigube — palette + theme
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "cream",
  "theme": "light"
}/*EDITMODE-END*/;

const PALETTES = {
  cream:  [["#f5f1ea","#3d5a3a","#c97a4a","#1a1a17"]],
  olive:  [["#efeadc","#5c6b3f","#b8864a","#211f17"]],
  ivory:  [["#fafaf7","#1f1f1f","#6b8e4e","#0f0f0e"]],
  terra:  [["#fff8ef","#d4844a","#2d3a2a","#2a2520"]],
};

function applyTheme(t) {
  document.documentElement.setAttribute("data-palette", t.palette || "cream");
  document.documentElement.setAttribute("data-theme",   t.theme   || "light");
  try { localStorage.setItem("tigube-tweaks", JSON.stringify(t)); } catch (e) {}
}

function TigubeTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => { applyTheme(t); }, [t.palette, t.theme]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Farbpalette" subtitle="Wechsle den Look mit einem Klick.">
        <TweakColor
          value={PALETTES[t.palette][0]}
          onChange={(v) => {
            const k = Object.keys(PALETTES).find(k => PALETTES[k][0] === v) || "cream";
            setTweak("palette", k);
          }}
          options={[PALETTES.cream[0], PALETTES.olive[0], PALETTES.ivory[0], PALETTES.terra[0]]}
        />
      </TweakSection>
      <TweakSection title="Modus">
        <TweakRadio
          value={t.theme}
          onChange={(v) => setTweak("theme", v)}
          options={[{value: "light", label: "Hell"}, {value: "dark", label: "Dunkel"}]}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

const root = document.createElement("div");
document.body.appendChild(root);
ReactDOM.createRoot(root).render(<TigubeTweaks />);
