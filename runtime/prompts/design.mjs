// Design system prompt for the Noethara coding agent.
// Edit here to change the visual standard of generated apps.
export const DESIGN_PROMPT = `# Design standard: premium, native-feeling mobile UI
Design like a top product team (Linear, Things 3, Arc, Apple). Every screen must look intentional on a 390x844 phone.

## Foundations
- Use tokens from src/theme.ts (colors, space, radius, type). Extend tokens there instead of hard-coding values in screens.
- Follow the user's palette or brand if given. Otherwise pick ONE accent on a refined neutral base (dark: #0B0B0F family, light: warm off-white #FAFAF7 family).
- 4/8pt spacing grid. Screen padding 20-24. Generous whitespace, grouped content, one primary action per screen.
- Type hierarchy: one display or title per screen, then headline, body, caption. Slight negative letter-spacing on large text. At most two weights per component.
- Contrast >= 4.5:1 for text. Muted color for secondary info. Semantic colors only for success, warning and danger.
- Depth through layered surfaces and 1px hairline borders (6-10% white/black). No rainbow gradients, no neon glows, no heavy shadows everywhere.
- Consistent radii: cards 16, buttons 14-16, chips and pills fully rounded. Touch targets >= 44pt.

## Layout
- SafeAreaView at the root. Content in ScrollView or FlatList. Cap content width (maxWidth ~560, centered) so the preview also looks right on tablets and web.
- Flexbox with gap. Absolute positioning only for overlays, sheets and floating buttons. Long text must wrap or use numberOfLines.
- Header: large title plus optional subtitle and one action. Use a bottom tab bar or segmented control for 2-5 sections.

## Components
- Buttons: primary (filled), secondary (surface + border), ghost. Pressed state (opacity 0.85, scale 0.98) and disabled state.
- Cards: surface color, hairline border, padding 16, radius 16. List rows 56-72 tall with icon tile, title, meta text and chevron.
- Inputs: 48-52 tall, label above, accent border when focused, helper or error text below.
- Icons: lucide-react-native, size 18-22, strokeWidth 2, token colors. Never use emoji as icons.
- Every data view has empty, loading (skeleton or ActivityIndicator) and error states.

## Motion (Animated API, useNativeDriver: true where supported)
- Entrance: fade + 12-16px rise, 300-450ms, Easing.out(Easing.cubic). Stagger list items 40-60ms.
- Press feedback on every tappable element. Animate state changes: expand/collapse, toggles, sliding tab indicator, progress.
- Durations 150-450ms. No endless bouncing or distracting loops.

## Content
- Realistic sample data (names, amounts, dates), never lorem ipsum. Short, friendly microcopy. Format numbers and dates.

## Self-review before the final report
Grid alignment, consistent spacing, hierarchy readable in two seconds, nothing touching screen edges, all states covered, motion present but calm.`;
