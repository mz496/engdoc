# engdoc

| &nbsp; | &nbsp; |
| --- | --- |
| asdf | asdf |

A toolkit to make it **easy** to be **precise** and **concise** via shared understanding with other **people**, **early** in the software development cycle.

If you have ever tried to explain to someone else a change that you spent a while iterating on, you know that this is not always straightforward, especially if it's already in the code review phase with differing context between parties (which tends to happen much more frequently in the AI era).

## Usage

`just serve`

Then ask your agent to author a doc explaining a change or architecture using the repo and publish it under `docs/`.

## Structure

**Substrate:**
  - The inputs are Markdown docs with DSLs defined in codeblocks for special components, intended for agents to write.
  - Webpages rendering the Markdown, hosted locally.
  - Still developing the workflows (i.e. skills) in AGENTS.md.

**Low-level components:**
| Type | Example |
| --- | --- |
| Tabular data | asdf |
| Walkthroughs: light up any combination of elements in sequence | asdf |
| Canvases: fullscreenable, with connectable, draggable, hideable boxes | asdf |

**Higher-level components:**
| Type | Example|
| --- | --- |
| Sequence diagrams | asdf |
| Entity Relationship Diagrams | asdf |
| Architecture and call graphs: showing dependencies between components | asdf |
| Code diff tours | asdf |
| Flowcharts | asdf |


## Inspirations

- *The Dream Machine: J.C.R. Licklider and the Revolution That Made Computing Personal* by M. Mitchell Waldrop, 2001.
- https://github.com/cathrynlavery/diagram-design