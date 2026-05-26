# AI_PRODUCT_WORKFLOW.md

Read before doing anything else:

- CONSTITUTION.md
- DESIGN.md
- BACKLOG.md
- all docs/specs/**/spec.md
- all docs/specs/**/plan.md
- current implementation

Your role is to help evolve the product carefully without introducing accidental complexity.

The product is:
- local-first;
- visually calm;
- image-centric;
- low-friction;
- intentionally small in scope.

The product is NOT:
- a cloud platform;
- a social product;
- a generic media manager;
- a scraping platform;
- an enterprise system.

Prioritize:
- simplicity;
- directness;
- feature-specific code;
- minimal dependencies;
- browser-native behavior;
- low operational complexity;
- cohesive UX.

Avoid:
- speculative scalability;
- over-abstraction;
- repositories;
- provider systems;
- service hierarchies;
- plugin systems;
- queues/workers unless absolutely necessary;
- unnecessary dependencies;
- generic infrastructure.

When discussing product evolution:

- first analyze:
    - current implementation;
    - current product shape;
    - current backlog friction;
    - existing feature boundaries;
    - architectural pressure introduced by recent features.

Then:
- propose the next most natural feature candidate based on real product evolution;
- explain why it matters now;
- explain what should explicitly remain out of scope.

Feature discovery rules:

- ask one question at a time;
- prioritize:
    - product behavior;
    - UX;
    - interaction flow;
    - scope boundaries;
    - emotional feel of the interface;
- avoid implementation questions too early;
- avoid feature creep;
- challenge unnecessary complexity;
- prefer the smallest viable feature.

When enough information exists:

- create:
    - docs/specs/XXX-feature-name/spec.md

Spec rules:

- focus on:
    - problem;
    - goal;
    - UX flow;
    - scope;
    - non-goals;
    - UX rules;
    - acceptance criteria;
    - explicit boundaries;
- avoid implementation details;
- preserve product identity.

After spec approval:

- create:
    - docs/specs/XXX-feature-name/plan.md

Plan rules:

- implementation-oriented;
- direct;
- concrete;
- no architecture theater;
- no unnecessary abstractions;
- no unnecessary dependencies;
- prefer modifying existing flows over creating parallel systems.

After implementation:

- review against:
    - approved spec;
    - approved plan;
    - CONSTITUTION.md;
    - DESIGN.md;
    - product simplicity;
    - accidental complexity;
    - dependency growth;
    - UX consistency;
    - security risks where applicable.

Do not continuously push for new features.

Prefer:
- real usage;
- observed friction;
- calm iteration;
- preserving simplicity.

The backlog represents:
- observed friction;
- product evolution;
- real usage pressure.

It is not a feature checklist.