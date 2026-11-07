# Skills

Each folder is one skill: a `SKILL.md` (frontmatter `name` + `description`, then the instructions)
plus any `references/`, `scripts/` and `assets/` it needs.

| Skill | Use it when |
|---|---|
| [figma-to-prototype](figma-to-prototype/SKILL.md) | you have a Figma link and want a working, 1:1 prototype (app or web) |

Install all of them with `npx skills@latest add vbirla789/figma-to-prototype`, or one with
`--skill <name>`.

## Adding a skill

1. Create `skills/<name>/SKILL.md` with lowercase-hyphen `name` and a description that says when
   to use it.
2. Keep `SKILL.md` short and put long material in `references/`, linked from `SKILL.md`.
3. Add a row to this table and to the root README.
