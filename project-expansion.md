# Unifi Insights Traffic Flows Exporter - Project Expansion

This document outlines the plan to expand the project with database storage and API capabilities for visualization in tools like Grafana.

## 1. Database Integration

### Database Choice: NeDB

We'll use NeDB, a lightweight embedded NoSQL database for Node.js:

- MongoDB-like API (familiar to many developers)
- Zero-configuration database
- Stores data in JSON format
- No separate installation required
- Perfect for smaller datasets and development

### Implementation Plan:

1. Create a data pipeline to:

   - Parse downloaded CSV files
   - Transform data into a suitable schema
   - Store in NeDB collections

2. Define database schema:
   - Traffic flows collection
   - Threats collection
   - Metrics collection (for aggregated data)

## 2. API Server

We'll implement a RESTful API server using Express.js:

### Endpoints:

- **Data Retrieval**:

  - `GET /api/flows` - List all traffic flows with filtering options
  - `GET /api/flows/:id` - Get specific flow details
  - `GET /api/threats` - List all threats with filtering options
  - `GET /api/threats/:id` - Get specific threat details

- **Metrics & Aggregation**:

  - `GET /api/metrics/flows/count` - Count of flows over time
  - `GET /api/metrics/flows/volume` - Traffic volume over time
  - `GET /api/metrics/threats/count` - Count of threats over time
  - `GET /api/metrics/threats/types` - Breakdown of threat types

- **Management**:
  - `POST /api/import` - Trigger import of new CSV data
  - `GET /api/status` - System status and last import information

### Authentication:

- Basic API key authentication for simple protection

## 3. Grafana Integration

The API will be designed to work seamlessly with Grafana:

- Use Grafana's SimpleJSON data source plugin
- Create sample dashboards for common visualizations:
  - Traffic flow patterns over time
  - Top talkers (source/destination)
  - Threat detection and classification
  - Geographic visualization of traffic

## 4. Development Phases

### Phase 1: Database Setup

- Implement CSV parsing and database storage
- Design and implement database schema
- Create data import utilities

### Phase 2: API Development

- Create basic Express.js server
- Implement core data retrieval endpoints
- Add filtering and query capabilities

### Phase 3: Metrics & Grafana Integration

- Add aggregation and metrics endpoints
- Create sample Grafana dashboards
- Document integration process

### Phase 4: Production Enhancements

- Add authentication
- Implement caching
- Performance optimizations
- Docker containerization

## 5. Future Considerations

- Real-time updates with WebSockets
- Alerting capabilities
- User management and multi-user support
- Custom visualization frontend
