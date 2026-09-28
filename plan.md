# MapReduce Visualizer --- Project Plan & Agent Instructions

## 1. Project Overview

Build an interactive, step-by-step visualizer that demonstrates how
Apache Hadoop MapReduce processes text across distributed workers, from
raw input to final aggregated output.

The application should function as both an educational tool and an
interactive debugger. Users can inspect each phase, examine intermediate
data, change configuration, and understand how data is transformed and
distributed.

### Core principles

-   **Educational:** Explain concepts from first principles without
    assuming prior knowledge.
-   **Interactive:** Let users step through the pipeline and inspect
    intermediate states.
-   **Technically grounded:** Model essential Hadoop mechanics while
    clearly distinguishing the simulation from a real Hadoop cluster.
-   **Deterministic:** Identical input and configuration must always
    produce identical results.
-   **Minimalistic:** Keep the current phase central and reveal extra
    detail on demand.
-   **Lightweight:** Minimize dependencies, abstractions, and
    implementation complexity.
-   **Maintainable:** Separate simulation logic, state management, and
    presentation.

### Technology stack

  Technology            Purpose
  --------------------- --------------------------------------------------
  Svelte                Reactive UI and component architecture
  JavaScript            Simulation algorithms and state management
  Tailwind CSS          Styling, layout, responsive design
  CSS animations        Lightweight transitions and data-flow animations
  Native browser APIs   Basic interactions and optional persistence

Use existing project versions and conventions. Avoid external
state-management, animation, icon, or visualization libraries unless a
concrete requirement justifies them.

## 2. MapReduce Pipeline

The application simulates a word-count job through five sequential
phases, preceded by input configuration.

### Phase 0: Input & Data Splitting

-   Accept user-provided text.
-   Divide it into a configurable number of logical input splits.
-   Assign each split to a virtual mapper task.
-   Display the original input, split boundaries, and resulting chunks.
-   Let users inspect each split.

**Accuracy requirement:** An HDFS block, an input split, and a mapper
task are not inherently identical. Model logical input splits assigned
to mapper tasks; do not claim each split is a physical block or machine.

### Phase 1: Mapping

Each mapper independently processes its assigned split.

-   Tokenize text into words.
-   Apply selected normalization and filtering options.
-   Emit intermediate key-value pairs in the form `(word, 1)`.
-   Preserve the mapper that emitted each pair.
-   Display intermediate output per mapper.

Example:

Input: `Cat dog cat`

Mapper output: `(cat, 1), (dog, 1), (cat, 1)`

Each mapper works independently and does not need to know how often a
word occurs in other mapper tasks.

### Phase 2: Shuffling & Sorting

-   Partition keys across reducers using a deterministic partitioning
    function.
-   Route identical keys to the same reducer.
-   Group values associated with each key.
-   Sort keys deterministically within each reducer.
-   Display origin mapper, destination reducer, and grouped values.
-   Visually demonstrate data transfer between mappers and reducers.

Distinguish partitioning, shuffling, grouping, and sorting as separate
operations within the broader shuffle-and-sort stage.

### Phase 3: Reducing

-   Consume grouped intermediate values.
-   Apply the configured aggregation function.
-   Produce final key-value pairs.
-   Show input values and aggregate results per key.
-   Preserve the reducer associated with each output.

The initial aggregation is word count by summation: `[1, 1, 1] → 3`.
Structure the engine so additional aggregation functions can be added
without rewriting the pipeline.

### Phase 4: Final Output Storage

-   Collect output from each reducer.
-   Represent each reducer's output as a separate simulated output file.
-   Display each file's contents.
-   Provide a combined, globally sorted view for convenient inspection.
-   Allow users to copy or download final output as plain text.

Explain that Hadoop typically writes reducer output to separate files; a
single globally sorted output file is not automatically produced.

## 3. Application Architecture

Separate the data-processing engine from the UI and interaction logic.

``` text
src/
├── lib/
│   ├── engine/
│   │   ├── split.js
│   │   ├── tokenize.js
│   │   ├── map.js
│   │   ├── shuffle.js
│   │   ├── reduce.js
│   │   └── pipeline.js
│   ├── components/
│   │   ├── InputPanel.svelte
│   │   ├── PipelineNav.svelte
│   │   ├── PhaseView.svelte
│   │   ├── WorkerNode.svelte
│   │   └── DataPair.svelte
│   └── data/
│       └── concepts.js
├── App.svelte
├── app.css
└── main.js
```

This is a suggested structure, not a requirement to create every file
immediately. Extract components when doing so improves clarity or reuse.

### Simulation engine

Use pure, reusable JavaScript functions for splitting, tokenization,
mapping, partitioning, shuffle/sort, reduction, and output generation.
Keep processing logic out of presentation components.

### State management

Use Svelte's built-in reactivity and a small, explicit state model.
Primary state may include:

-   Raw input text
-   Current phase index
-   Number of mapper tasks
-   Number of reducers
-   Case-sensitivity setting
-   Stop-word filtering setting
-   Animation and autoplay state, when implemented

Derive pipeline data from the input and configuration wherever
practical. Avoid redundant copies of values.

Navigation should change the displayed phase, not mutate earlier results
or trigger a different simulation. When input or configuration changes,
recalculate dependent results and return the user to an appropriate
phase so stale data is never shown.

## 4. Incremental Development Roadmap

Each version should produce a working application. Do not implement
future-version infrastructure prematurely.

### Version 1: Core Pipeline & State Engine

**Objective:** Build a complete, correct simulation before adding visual
complexity.

-   Text input with a sensible default example.
-   Configurable mapper and reducer counts.
-   Five-phase pipeline with Next, Previous, and Reset controls.
-   Deterministic split, map, shuffle, reduce, and output functions.
-   Clear phase descriptions and basic intermediate-data views.
-   Input validation and empty-state handling.
-   Recalculation when input or configuration changes.

**Completion criteria:** Every phase displays correct results,
navigation works consistently, and changes never leave stale or
inconsistent data.

### Version 2: Visual Nodes & Data Flow

**Objective:** Make distributed processing intuitive to follow.

-   Virtual mapper and reducer node representations.
-   Visual input-split allocation.
-   Intermediate key-value pair cards.
-   Animated shuffle routing.
-   Clear distinction between mapper and reducer tasks.
-   Selection of individual workers to inspect their data.
-   Responsive layouts for smaller screens.

**Completion criteria:** Users can follow data from input split through
mapping, shuffle, and reduction.

### Version 3: Interactive Parameters

**Objective:** Let users experiment with configuration.

-   Case-sensitive and case-insensitive processing.
-   Common stop-word filtering.
-   Configurable mapper and reducer counts.
-   Configurable split strategy.
-   Deterministic partitioning.
-   Live recalculation of phase results.
-   Clear explanations of parameter effects.

**Completion criteria:** Every option produces predictable, explainable
changes without breaking the pipeline.

### Version 4: Polish, UX & Guided Learning

**Objective:** Refine the app into a cohesive educational experience.

-   Sleek, modern, minimalistic interface.
-   Light and dark themes.
-   Purposeful transitions and animations.
-   Contextual educational tooltips.
-   Play, Pause, and adjustable autoplay speed.
-   Phase progress indicator.
-   Keyboard navigation.
-   Copy and download output.
-   Accessible controls and reduced-motion support.
-   Responsive and performance refinements.

**Completion criteria:** The application is consistent, responsive,
accessible, intuitive, and retains a simple underlying simulation.

## 5. UI/UX & Visual Design

The app should feel like a modern developer tool: clean, technical,
sophisticated, and engaging without unnecessary decoration.

### Design direction

-   **Minimalistic:** Use whitespace, restrained borders, and clear
    hierarchy.
-   **Modern:** Use crisp typography, subtle depth, rounded corners, and
    consistent spacing.
-   **Technical:** Represent nodes, data pairs, partitions, and
    transformations authentically.
-   **Interactive:** Animate meaningful data changes rather than adding
    decorative motion.
-   **Focused:** Keep the current phase central and make secondary
    information available on demand.

### Layout

A recommended desktop layout includes:

-   A compact header with app name and theme control.
-   A clear phase navigation/progress bar.
-   A configuration panel.
-   A main visualization area.
-   A concise phase explanation or learning panel.
-   Previous, Next, Reset, and later Play/Pause controls.

On mobile, stack configuration and visualization rather than compressing
the desktop layout.

### Color and motion

-   Use neutral backgrounds, muted secondary text, and one restrained
    accent color.
-   Assign consistent visual identities to mappers, reducers,
    intermediate data, and output.
-   Never communicate meaning through color alone; use labels, shapes,
    or icons too.
-   Keep shadows, gradients, and glow effects subtle.
-   Use short transitions for navigation and data-state changes.
-   Avoid continuous, distracting movement.
-   Respect the operating system's reduced-motion preference.

## 6. Educational Experience

Each phase should answer three questions: what happens, why it happens,
and how it relates to Hadoop.

  -----------------------------------------------------------------------
  Phase                   Core question           Concept
  ----------------------- ----------------------- -----------------------
  Input & Split           How is data prepared?   Input splits and mapper
                                                  assignment

  Mapping                 How is raw text         Independent map tasks
                          transformed?            and intermediate pairs

  Shuffle & Sort          How does data get       Partitioning, transfer,
                          grouped?                grouping, and sorting

  Reducing                How are results         Aggregation of grouped
                          calculated?             values

  Output                  Where do results go?    Reducer output files
                                                  and HDFS
  -----------------------------------------------------------------------

Each phase should provide:

-   A short explanation of the operation.
-   Why the operation is necessary.
-   A visual representation of the transformation.
-   Before-and-after data inspection.
-   An optional "Learn more" section about the Hadoop equivalent.

Keep educational text concise by default. Avoid overwhelming users with
long explanations.

## 7. Functional & Technical Requirements

### Deterministic processing

-   The same input and configuration must always produce the same
    results.
-   The same key must always be assigned to the same reducer when
    partitioning configuration is unchanged.
-   Avoid random distribution and dependence on unpredictable iteration
    order.
-   Results must remain reproducible when navigating backward and
    forward.

### Data handling

-   Define consistent structures for splits, intermediate pairs, grouped
    values, reducer results, and output files.
-   Preserve intermediate-data origins for inspection and animation.
-   Define behavior for whitespace, punctuation, capitalization,
    repeated words, Unicode, and empty input.
-   Set reasonable input-size and configuration limits.
-   Ensure configuration changes recalculate all dependent data.

### Navigation and controls

-   Next and Previous navigate the same deterministic pipeline.
-   Reset restores the default input and configuration.
-   Handle navigation boundaries appropriately.
-   Autoplay stops at completion and must not conflict with manual
    navigation.
-   Configuration changes during autoplay should stop or restart
    playback consistently.

### Error handling

-   Validate input and configuration before processing.
-   Handle empty input, whitespace-only input, zero-length splits, and
    empty reducer partitions.
-   Prevent invalid configuration from creating inconsistent data.
-   Provide useful, unobtrusive error messages without exposing
    implementation details.

### Performance

-   Use synchronous processing for small text inputs.
-   Avoid unnecessary recalculation and repeated transformations.
-   Use keyed Svelte rendering for dynamic lists where appropriate.
-   Add complex optimizations only when measurements justify them.

## 8. Mandatory Coding Standards

The AI coding agent must strictly follow these rules throughout the
project.

1.  **Absolutely no code comments.** Do not add inline comments, block
    comments, JSDoc, TODOs, or commented-out code anywhere in source
    code. Use descriptive identifiers and clear structure instead.
2.  **Treat every line of code as a liability.** Prefer the smallest
    implementation that completely and reliably solves the problem.
3.  **Readable and well-formatted code.** Use consistent formatting,
    logical structure, and clear separation of responsibilities.
4.  **Modular and reusable design.** Extract shared logic when it
    reduces complexity or duplication. Avoid premature abstraction and
    unnecessary component fragmentation.
5.  **Short but explanatory identifiers.** Use concise, meaningful
    names. Avoid cryptic abbreviations and excessively long names.
6.  **Simplicity over cleverness.** Prefer straightforward algorithms,
    native features, and understandable control flow.
7.  **Single responsibility.** Each function and component should have a
    clear purpose. Keep simulation logic out of presentation components.
8.  **Robustness by design.** Handle meaningful edge cases, validate
    inputs, and maintain consistent state. Avoid speculative
    error-handling layers.
9.  **No unnecessary dependencies.** Prefer existing Svelte, JavaScript,
    CSS, and Tailwind capabilities. Every dependency must have a
    concrete benefit.
10. **Avoid redundant state.** Derive values wherever practical; do not
    store the same information in multiple places without a reason.
11. **Preserve existing functionality.** Make focused changes and avoid
    rewriting stable code without clear benefit.
12. **Verify before completion.** Check builds, pipeline correctness,
    navigation, responsiveness, and accessibility.

### Additional implementation principles

-   Use the project's established Svelte syntax and conventions
    consistently.
-   Keep functions pure wherever practical, especially in the simulation
    engine.
-   Avoid unnecessary side effects, deeply nested conditionals, and
    overly generic solutions.
-   Prefer semantic HTML and accessible controls.
-   Do not use emojis as substitutes for meaningful icons or visual
    design.
-   Do not present placeholder functionality as complete.
-   Do not sacrifice correctness or accessibility for visual effects.
-   Inspect the existing codebase before making changes.

## 9. Testing & Acceptance Criteria

The project is complete only when the following are verified:

-   The complete pipeline processes sample input correctly.
-   Splits and mapper assignments are deterministic.
-   Intermediate key-value pairs are preserved and traceable.
-   Every key is assigned to the same reducer.
-   Shuffle groups and sorts keys deterministically.
-   Reducers calculate correct aggregates.
-   Final output matches combined reducer results.
-   Next, Previous, and Reset behave consistently.
-   Configuration changes recalculate affected phases.
-   Case sensitivity and stop-word filtering work correctly.
-   Empty input and edge cases are handled safely.
-   Autoplay and manual navigation do not conflict.
-   Animations do not alter simulation results.
-   The interface is responsive, keyboard accessible, and supports
    reduced motion.
-   The project builds without errors or unnecessary dependencies.

Use the existing test infrastructure where available. If none exists,
add lightweight tests only where they materially improve confidence in
the simulation engine.

## 10. Scope Boundaries

### In scope

-   Client-side simulation of essential Hadoop MapReduce stages.
-   Virtual mapper and reducer workers.
-   Deterministic splitting, mapping, partitioning, grouping, sorting,
    and reduction.
-   Interactive phase-by-phase inspection.
-   Configurable processing parameters.
-   Simulated HDFS output.
-   Educational explanations and visual data flow.

### Out of scope initially

-   A real Hadoop cluster or distributed execution.
-   Actual HDFS integration or file-system operations.
-   Real network communication between workers.
-   Fault-tolerant execution, task retries, and speculative execution.
-   Real-time performance benchmarks or Hadoop scheduling.
-   Large-scale processing or arbitrary user-defined MapReduce programs.

Clearly communicate these boundaries in the UI so users understand which
operations are simulated and which correspond to actual Hadoop behavior.

## 11. Recommended Defaults

  Decision                Default
  ----------------------- ----------------------------------------------
  Framework               Svelte version already installed
  Language                Plain JavaScript
  Styling                 Tailwind CSS
  State                   Built-in Svelte reactivity
  Initial algorithm       Word count
  Input                   User-entered plain text
  Splitting               Configurable logical splits
  Mapper/reducer counts   Independently configurable
  Tokenization            Whitespace- and punctuation-aware
  Partitioning            Stable deterministic hash
  Sorting                 Lexicographical key ordering
  Execution               Entirely client-side
  Animation               Native CSS, introduced incrementally
  Themes                  Light and dark
  Persistence             None initially
  Testing                 Existing infrastructure or lightweight tests

Keep the simulation's logical results separate from animations. Compute
the pipeline deterministically, then animate transitions between
established states. This keeps the debugger reliable when users navigate
quickly, pause playback, or change settings.

## 12. Instructions for the AI Coding Agent

You are an experienced frontend engineer tasked with building a
polished, interactive MapReduce Phases Visualizer using Svelte,
JavaScript, and Tailwind CSS.

Your objective is to implement the application incrementally, following
this plan, architecture, functional requirements, design direction, and
coding standards.

### Development workflow

1.  Inspect the existing project structure, dependencies, Svelte
    version, Tailwind configuration, and implementation before changing
    anything.
2.  Identify the smallest set of changes needed to implement the
    requested functionality.
3.  Implement the roadmap incrementally, ensuring each version remains
    functional.
4.  Keep the simulation engine independent of the UI and all processing
    deterministic.
5.  Verify correctness, interactions, responsiveness, and build status
    after changes.
6.  When reporting completion, summarize what was implemented, what was
    verified, and any remaining limitations.

### Non-negotiable rules

-   Never add code comments of any kind.
-   Keep code simple, concise, readable, modular, and reusable.
-   Treat every line as a liability.
-   Use short, descriptive identifiers.
-   Avoid redundant state, duplicated logic, unnecessary dependencies,
    premature abstractions, and overengineering.
-   Prefer native Svelte, JavaScript, and CSS.
-   Do not compromise correctness, maintainability, or accessibility for
    brevity.

### Design requirements

The application must look sleek, modern, minimalistic, and cool, with a
polished developer-tool aesthetic. Use clean typography, restrained
colors, intentional spacing, subtle borders, purposeful animations,
light and dark themes, and a responsive layout.

Avoid clutter, excessive cards, decorative elements, gradients,
distracting animations, and complicated navigation. Every visual element
must serve a functional or educational purpose.

### Functional requirements

Implement input splitting, mapping, shuffling and sorting, reducing, and
final output storage. Maintain deterministic results, inspectable
intermediate states, and reliable phase navigation.

Explain the real-world Hadoop equivalent of each phase while clearly
distinguishing the simplified simulation from actual Hadoop execution.

### Implementation discipline

Do not implement future-version features prematurely unless required by
the current version. Do not add dependencies without concrete
justification. Avoid rewriting working code without a clear benefit.

Verify actual behavior rather than assuming successful compilation
guarantees correctness.

The final application should be easy to understand, pleasant to use,
technically accurate within its stated simulation boundaries, and
straightforward for another developer or AI agent to extend.

## Final Recommendation

Build the engine first, then make it beautiful. A correct and
deterministic simulation provides the foundation; a carefully designed
interface makes the concepts intuitive. Complete Version 1 with a clean,
usable UI, then progressively introduce visual nodes, animations,
customization, and guided learning without redesigning the core
architecture.

The defaults in this plan are sufficient to begin implementation.
Remaining design decisions can be made as the application takes shape.
