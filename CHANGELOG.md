# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-07-29

### Added
- AWS S3 integration for scalable file storage
- Comprehensive S3 service with secure file upload/download
- Presigned URL generation for direct browser uploads
- S3 migration tools for existing attachments
- Terraform configuration for S3 bucket provisioning
- File type validation and security enhancements
- Sharp image processing integration
- Mime-types detection for file uploads
- Clear cache utility for production deployments
- New webpack-based development script for better DX
- Support for Turbopack development mode
- Weekly storage calculation scripts
- S3 setup and configuration documentation

### Changed
- **BREAKING**: Upgraded React from 18.2.0 to 19.1.1
- **BREAKING**: Upgraded Next.js from 14.1.3 to 15.4.4
- **BREAKING**: File attachments now require S3 configuration
- Upgraded Recharts from 2.12.2 to 3.1.0
- Upgraded Lucide React from 0.356.0 to 0.532.0
- Upgraded Prisma from 5.22.0 to 6.12.0
- Upgraded bcryptjs from 2.4.3 to 3.0.2
- Upgraded date-fns from 3.3.1 to 4.1.0
- Upgraded next-themes from 0.2.1 to 0.4.6
- Simplified dashboard to show only inventory levels graph
- Removed Operations and Finance sections from dashboard
- Removed all "Quick Actions" boxes from dashboard
- Dashboard now loads data automatically without refresh buttons
- Fixed date range issues in inventory trend chart
- Improved mobile responsiveness for time range selector
- Refactored client logger from class-based to functional approach
- Updated all type definitions for React 19 compatibility

### Fixed
- Dashboard graph now correctly shows all days up to current date
- Fixed unique constraint violations in transaction ID generation
- Fixed SWC helpers and module resolution errors with React 19
- Fixed month boundary issues in date iteration logic
- Improved error handling for file uploads
- Enhanced security for file type validation

### Removed
- Removed base64 file storage in favor of S3
- Removed filesystem-based attachment storage
- Removed manual refresh buttons from dashboard
- Removed Operations section from dashboard
- Removed Finance section from dashboard
- Removed Quick Actions boxes throughout the application
- Removed deprecated performance scripts
- Removed unused database cleanup scripts

### Security
- Added comprehensive file upload validation
- Implemented secure S3 presigned URLs with expiration
- Added file size limits and MIME type restrictions
- Prepared infrastructure for virus scanning integration

### Infrastructure
- Added Terraform modules for S3 bucket creation
- Updated Ansible playbooks with S3 environment variables
- Enhanced deployment workflow for S3 integration
- Added production-ready S3 bucket policies

## [0.1.0] - Previous Release

Initial release of the Warehouse Management System.