# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Features

- Track suppressed messages (#6) by @Saturate in [#6](https://github.com/Saturate/qualink/pull/6) ([e17ff8e](https://github.com/Saturate/qualink/commit/e17ff8e95fd46c0a53b0a1a015cfb0f816512f2d))

- Web vitals, filmstrip, and Kibana dashboard (#8) by @Saturate in [#8](https://github.com/Saturate/qualink/pull/8) ([1ac3710](https://github.com/Saturate/qualink/commit/1ac37107e09f967353fbb3115b747ee845a096a8))


## [0.2.0] - 2026-03-03

### Features

- Add Loki sink for Grafana + Loki stack by @Saturate ([a3a9830](https://github.com/Saturate/qualink/commit/a3a9830d5b12019a00779a10183781acf92e3ab5))


### Bug Fixes

- Use GitHub App token for changelog push (#3) by @Saturate in [#3](https://github.com/Saturate/qualink/pull/3) ([43c3ff9](https://github.com/Saturate/qualink/commit/43c3ff9e9aa2a173fa677cc9f512b69c8ae5fe73))

- Pass app token to git-cliff for GitHub API access (#4) by @Saturate in [#4](https://github.com/Saturate/qualink/pull/4) ([2e66f3f](https://github.com/Saturate/qualink/commit/2e66f3ff70f138b2689fb838186c56d62ad6fa44))

- Add workflow_dispatch trigger to release workflow (#5) by @Saturate in [#5](https://github.com/Saturate/qualink/pull/5) ([4ff6667](https://github.com/Saturate/qualink/commit/4ff6667141dc2ab336a1f0d29b2c839796141a23))


### Documentation

- Add GitHub sponsor funding link by @Saturate ([6979829](https://github.com/Saturate/qualink/commit/69798297c7270e4b03770e18487a2c0e58f469d5))

- Update license year by @Saturate ([2ff1476](https://github.com/Saturate/qualink/commit/2ff14768ff3d21d5d3d54d2e9706b2c500ad96bb))

- Add contributing guide by @Saturate ([28a494f](https://github.com/Saturate/qualink/commit/28a494ff66034af0e05e177accb3c3f0856b9299))


### Miscellaneous

- Bump version to 0.2.0 (#2) by @Saturate in [#2](https://github.com/Saturate/qualink/pull/2) ([22c565b](https://github.com/Saturate/qualink/commit/22c565bf3a24348f31679cc6d1b2bc89abd97d10))


## [0.1.1] - 2026-03-02

### Bug Fixes

- Remove preinstall script that blocks non-pnpm consumers by @Saturate ([d9b240f](https://github.com/Saturate/qualink/commit/d9b240ff34854b0b0642c51c5b9994cedd694eb2))


## [0.1.0] - 2026-03-02

### Features

- Auto-detect monorepo package name + CI example fixes by @Saturate ([cf3045c](https://github.com/Saturate/qualink/commit/cf3045ca0526567071ae21af7b2656fb10b676c7))

- Auto-detect .csproj project name + .NET solution examples by @Saturate ([b952c2c](https://github.com/Saturate/qualink/commit/b952c2c83a961b77cf370e0d3720155b1a4c9354))


### Refactor

- Split shared.ts into focused modules, add unit tests + coverage by @Saturate ([57e0d9a](https://github.com/Saturate/qualink/commit/57e0d9a69d0ee0571459bd994181754e2ac2c43d))


### Documentation

- Restructure examples, flesh out sample reports, misc fixes by @Saturate ([c6e4ce2](https://github.com/Saturate/qualink/commit/c6e4ce234dabee924d2f9eaa2bcdfa24bf6c30cb))

- Add install guidance and pin qualink version by @Saturate ([8ffe5ed](https://github.com/Saturate/qualink/commit/8ffe5ed91000319bb3aec33a3030d7b23c848959))

- Drop version pin from npx qualink by @Saturate ([e66528a](https://github.com/Saturate/qualink/commit/e66528ad561fd94c48c382c8e35b1d852c885ab8))


### Testing

- Bump coverage for collectors, sinks, and send-to-sink by @Saturate ([d71e8d0](https://github.com/Saturate/qualink/commit/d71e8d0cbf1063810974dfa5566b60045ec59302))


### Miscellaneous

- Add CI/CD pipelines, git-cliff changelog, and GitHub repo metadata by @Saturate ([2831165](https://github.com/Saturate/qualink/commit/2831165f8657f51aaf66551ce9f83c0c76b6b440))

- Bump node matrix to 22+24, require node >=22 by @Saturate ([835f152](https://github.com/Saturate/qualink/commit/835f15290eafda7adb6315376f9a52fa3a28a400))

- Pre-launch audit fixes + changelog automation by @Saturate ([7de907f](https://github.com/Saturate/qualink/commit/7de907fa0ee2817c4043a0a236afd9c44f0931d5))


