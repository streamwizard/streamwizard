# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Twitch OAuth configured for local development

### Changed
- Dropped legacy app token columns from the database schema

### Fixed
- Auto-bootstrap Twitch app token on fresh deploy
- Missing `auth.users` trigger migrations
- CI build checks and PR workflows

## [0.1.0] - 2025-01-01

### Added
- Initial monorepo setup with REST API, WebSocket server, bot, web app, and overlay apps
- Supabase database pipeline with staging and production migration workflows
- Docker-based build checks for all apps
- Doppler integration for secrets management
- OSS community files (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
