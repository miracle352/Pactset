export const motionSystem = {
  duration: {
    feedback: 0.18,
    menu: 0.26,
    content: 0.58,
    section: 0.72,
  },
  ease: {
    enter: "power3.out",
    settle: "power2.out",
  },
  distance: {
    compact: 10,
    content: 18,
    section: 28,
  },
  stagger: {
    word: 0.045,
    item: 0.065,
  },
} as const;
