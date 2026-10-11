import { useEffect } from "react";
import { PHASE_LABELS } from "../shared/phase/index.ts";
import styles from "./styles/gate.module.css";
import "./styles/tokens.css";
import { Badge } from "./Badge.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { TooltipLayer } from "./Tooltip.tsx";
import { NOTICE, variantColor, type GateFigure } from "./model.ts";

interface GateProps {
  unit: "m" | "ft";
  direct: boolean;
  figures: GateFigure[];
  onUnit: (unit: "m" | "ft") => void;
  onDirect: (on: boolean) => void;
  onEnter: () => void;
}

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "overlay",
    title: "Two airframes, one frame",
    body: "Side by side, stacked, or overlaid on the wing box. The -1000 is the -900 plus its published plugs, so the stretch shows up where it really is.",
  },
  {
    icon: "flight",
    title: "Gate to 10,000 ft",
    body: `Scrub ${PHASE_LABELS.length} phases from pushback to climb. Lights, flaps, slats, and gear follow the phase while the camera follows the aircraft.`,
  },
  {
    icon: "expand",
    title: "Explode and section",
    body: "Pull the skin, engines, and gear away from the body, then cut the airframe on any axis to see structure, fuel, and systems inside.",
  },
  {
    icon: "book",
    title: "Every number cited",
    body: "Each figure carries its grade and source. Where Airbus and EASA disagree, both claims are shown. Schematic layers say they are schematic.",
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "Pick an airframe",
    body: "The switch at the top picks the A350-900 or the A350-1000. The weight variant sits in the spec panel. Regional is on the -900 only.",
  },
  {
    title: "Choose a layout",
    body: "Single, side by side, stacked, or overlay. In a split, Sync decides what the panes share: camera, explode and flight, layers, and section.",
  },
  {
    title: "Move the camera",
    body: "Drag to orbit, right-drag to pan, scroll to zoom. Keys 1 to 4 set plan, side, front, and three-quarter. F toggles perspective inspect.",
  },
  {
    title: "Switch layers",
    body: "Fourteen layers from skin to bleed air, in groups. The presets set a whole view at once. Solo ghosts everything else.",
  },
  {
    title: "Run the departure",
    body: "Press play, or Space, and the aircraft pushes back, taxis, lines up, rotates, and climbs. Drag the timeline to scrub it by hand.",
  },
  {
    title: "Read the numbers",
    body: "Hover a part for a preview, click to pin it. Sourced means published. Derived means computed from published figures. Schematic means it is ours.",
  },
];

export function Gate({ unit, direct, figures, onUnit, onDirect, onEnter }: GateProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.target === document.body) onEnter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnter]);

  return (
    <div className={styles.gate}>
      <header className={styles.hero}>
        <img className={styles.heroImg} src="./og.jpg" alt="" />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <nav className={styles.nav}>
          <span className={styles.logo}>
            <span className={styles.logoMark} aria-hidden="true">
              <Icon name="plane" size={16} />
            </span>
            A350 Study
          </span>
          <div className={styles.navLinks}>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#settings">Settings</a>
          </div>
        </nav>
        <div className={styles.heroBody}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>
              <span className={styles.kickerDot} aria-hidden="true" />
              Independent study model · Fig. 1
            </p>
            <h1 className={styles.name}>A350 Study</h1>
            <p className={styles.deck}>
              {"The A350-900 and A350-1000 on one frame. Take them apart, cut them open, and fly them to 10,000 ft, with every published number cited."}
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.enter} onClick={onEnter}>
                Open the study
                <Icon name="arrowRight" size={18} />
              </button>
              <a className={styles.action} href="#how">
                How it works
              </a>
            </div>
            <p className={styles.enterHint}>
              {"Press "}
              <kbd>Enter</kbd>
              {" to open. Runs in this browser, with nothing sent anywhere."}
            </p>
          </div>

          <section className={styles.glance} aria-label="At a glance">
            <div className={styles.glanceHead}>
              <p className={styles.glanceTitle}>At a glance</p>
              <div className={styles.glanceCols} aria-hidden="true">
                <span>
                  <span className={styles.dot} style={{ background: variantColor("a350-900") }} />
                  -900
                </span>
                <span>
                  <span className={styles.dot} style={{ background: variantColor("a350-1000") }} />
                  -1000
                </span>
              </div>
            </div>
            <dl className={styles.glanceList}>
              {figures.map((figure) => (
                <div key={figure.label} className={styles.glanceRow}>
                  <dt>{figure.label}</dt>
                  {figure.cells.map((item) => (
                    <dd key={item.variantId}>
                      <span className={styles.figure}>{item.text}</span>
                      <span className={styles.badges}>
                        {item.badges.map((badge) => (
                          <Badge key={badge} text={badge} />
                        ))}
                      </span>
                    </dd>
                  ))}
                </div>
              ))}
            </dl>
            <p className={styles.glanceFoot}>{"High-gross columns. Airbus Facts & Figures, June 2026."}</p>
          </section>
        </div>
      </header>

      <main className={styles.main}>
        <section id="features" className={styles.section} aria-label="What is this">
          <p className={styles.eyebrow}>What is this</p>
          <h2 className={styles.h2}>{"A study model, not a brochure."}</h2>
          <p className={styles.lede}>
            {"Overall length, span, and height follow the published figures. Panel lines, systems, and the flight motion are schematic, and the app says so wherever they appear. It is not an Airbus document, and it is not for maintenance, training, or flight operations."}
          </p>
          <div className={styles.features}>
            {FEATURES.map((feature) => (
              <article key={feature.title} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <Icon name={feature.icon} size={20} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className={styles.section} aria-label="Tutorial">
          <p className={styles.eyebrow}>How it works</p>
          <h2 className={styles.h2}>{"Six things to know."}</h2>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNum}>{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="settings" className={styles.section} aria-label="Settings">
          <p className={styles.eyebrow}>Settings</p>
          <h2 className={styles.h2}>{"Stays in this browser."}</h2>
          <div className={styles.settings}>
            <div className={styles.setting}>
              <div>
                <h3>Units</h3>
                <p>{"Labelled figures follow this choice. Press U inside the study to switch."}</p>
              </div>
              <div className={styles.segmented} role="group" aria-label="Units">
                <button type="button" aria-pressed={unit === "m"} onClick={() => onUnit("m")}>
                  Metres
                </button>
                <button type="button" aria-pressed={unit === "ft"} onClick={() => onUnit("ft")}>
                  Feet
                </button>
              </div>
            </div>
            <div className={styles.setting}>
              <div>
                <h3>Skip this page</h3>
                <p>{"Open the study straight away next time. The name in the study still brings you here."}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={direct}
                aria-label="Open the study when I come back"
                className={styles.switch}
                onClick={() => onDirect(!direct)}
              />
            </div>
          </div>
          <div className={styles.cta}>
            <button type="button" className={styles.enter} onClick={onEnter}>
              Open the study
              <Icon name="arrowRight" size={18} />
            </button>
          </div>
        </section>
      </main>
      <footer className={styles.notice}>{NOTICE}</footer>
      <TooltipLayer />
    </div>
  );
}
