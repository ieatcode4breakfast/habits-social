# Help Center

The directory content\user-help is for user-facing help documentation, including tips, tutorials, guides, and related support content.

## AI Writing Guidelines

Follow these rules for consistency. Refer to existing help docs in content\user-help when available, and match their tone, style, and structure.

Write in a calm, practical, trustworthy tone with a small amount of warmth. Be clear, direct, and supportive without sounding overly cheerful, salesy, childish, or judgmental. Your job is to help users understand what the product does, make the right choice, and recover from common mistakes with confidence.

Use plain English. Prefer short paragraphs, clear headings, compact examples, and simple tables when behavior changes based on a status, setting, permission, or user action. Match the product's platform and interaction model: use words like "tap," "click," "select," "open," or "choose" based on how users actually interact with the product.

Before writing, infer the product's core user values from the surrounding context, existing UI copy, product category, and feature behavior. Preserve those values in the docs. For example, if the product handles personal data, collaboration, payments, health, security, productivity, or irreversible changes, make the relevant user impact clear.

For every help article:

1. Start with a direct title that names the feature or task.
2. Add a brief intro that explains the feature in user-facing terms and why it matters.
3. State the most important rule early, especially when missing it could change progress, visibility, privacy, billing, access, or data.
4. Explain important limits, permissions, edit windows, visibility rules, offline behavior, eligibility requirements, or irreversible outcomes when they affect the result.
5. Use tables for status-driven behavior. Keep table labels short and write outcomes in plain English.
6. Include short examples when they make the rule easier to understand.
7. Include FAQs for predictable user confusion, especially "why did this happen?" and "can I fix it?" questions.
8. End only when the user's likely follow-up questions are answered. Do not add filler next steps.

Always explain the user-visible outcome of an action. If something is shared, say who can see it. If something is deleted, say whether it can be recovered. If something is synced, exported, billed, published, submitted, invited, or revoked, explain what changes for the user and any other affected people.

Be precise. Avoid vague phrases like "improves your experience," "keeps things organized," or "helps you stay on track" unless you also explain the actual result. Do not hide caveats after the main steps.

When writing about progress, streaks, habit logs, recovery, missed actions, or similar user behavior:

- Stay factual but encouraging. It is fine to use phrases like "keeps your progress moving," "fresh start," or "may still be recoverable" when they accurately describe the product behavior.
- Avoid blame, guilt, pressure, or moralizing. If honesty matters, frame it as helping the user's progress reflect what they want it to mean.
- Explain cause and effect directly. Example: "If a habit is left unlogged, it counts as a missed day and can end the streak."
- Mention exact recovery windows or limits, such as "past 7 days," instead of saying something is "available" or "recent."
- Use callouts sparingly for rules users should not miss.
- Keep recovery guidance practical: say what the user can do, what the app recalculates or updates, and what outcome to expect.

Recommended article structure for feature explainers:

1. `# Feature Name`
2. Two short intro paragraphs that define the feature and explain what the guide covers.
3. A status or rules section near the top when the feature depends on user choices.
4. Focused sections for the main concepts.
5. One short example table when useful.
6. FAQs for edge cases and common confusion.

Avoid:

- Long motivational intros.
- Marketing language.
- Blame or guilt.
- "Just" for tasks involving setup, permissions, recovery, payment, privacy, or data loss.
- Overly casual jokes, slang, or pep-talk language.
- Internal implementation details, source file names, API names, stack traces, database behavior, or security mechanisms.
- Promising behavior that is not supported by the product context.
- Vague recovery language like "if available" when the product has a known limit.

The final documentation should feel compact, accurate, respectful, and easy to follow.
