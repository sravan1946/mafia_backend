# Mafia Game Backend - VPS Deployment

A complete Docker Compose setup for running the Mafia Game backend on your VPS.

## 🚀 Quick Deployment

### 1. Prerequisites
- VPS with Ubuntu/Debian
- Docker and Docker Compose installed
- Domain name (optional, for SSL)

### 2. Clone and Setup
```bash
# Clone the backend to your VPS
git clone <your-repo-url> mafia_backend
cd mafia_backend

# Run the deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### 3. Configure Environment
Edit the `.env` file with your Appwrite API key:
```bash
nano .env
```

## 📁 File Structure
```
mafia_backend/
├── docker-compose.yml      # Main deployment configuration
├── Dockerfile              # Node.js application container
├── package.json            # Node.js dependencies
├── server.js               # Express.js server
├── env.example             # Environment variables template
├── .env                    # Your environment variables (create this)
├── nginx/
│   └── nginx.conf          # Nginx reverse proxy configuration
├── scripts/
│   ├── deploy.sh           # Deployment automation
│   └── setup-ssl.sh        # SSL certificate generation
└── README.md               # This file
```

## 🔧 Configuration

### Environment Variables (.env)
```env
# Backend Configuration
PORT=3000
NODE_ENV=production

# Appwrite Configuration
APPWRITE_ENDPOINT=https://appwrite.p1ng.me/v1
APPWRITE_PROJECT_ID=68837172000c488faf55
APPWRITE_API_KEY=your_api_key_here
```

### SSL Certificates
- **Development**: Self-signed certificates (auto-generated)
- **Production**: Use Let's Encrypt or your own certificates

## 📡 API Endpoints

### Health Check
- `GET /health` - Check if server is running

### Game Logic
- `POST /api/assign-roles` - Assign roles to players
- `POST /api/process-night-actions` - Process night phase actions
- `POST /api/process-voting` - Process day phase voting

## 🛠️ Management Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f mafia-backend
```

### Restart Services
```bash
docker-compose restart
```

### Update Application
```bash
git pull
docker-compose up -d --build
```

### Check Status
```bash
docker-compose ps
```

## 🔒 Security Features

- **Rate Limiting**: 10 requests/second per IP
- **SSL/TLS**: HTTPS encryption
- **Security Headers**: XSS protection, frame options, etc.
- **Non-root User**: Application runs as non-root user
- **Health Checks**: Automatic container health monitoring

## 🌐 Production Setup

### 1. Domain Configuration
Update `nginx/nginx.conf` with your domain:
```nginx
server_name your-domain.com;
```

### 2. SSL Certificates (Production)
Replace self-signed certificates with Let's Encrypt:
```bash
# Install certbot
sudo apt install certbot

# Get certificates
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

### 3. Firewall Configuration
```bash
# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Block direct access to backend
sudo ufw deny 3000
```

## 🔄 Update Flutter App

After deploying, update your Flutter app's `database_service.dart`:

```dart
// Replace Appwrite Function calls with HTTP requests
final response = await http.post(
  Uri.parse('https://your-domain.com/api/assign-roles'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'roomId': roomId,
    'playerIds': playerIds,
    'gameSettings': gameSettings.toJson(),
  }),
);
```

## 🧪 Testing

### Local Testing
```bash
# Test health endpoint
curl https://your-domain/health

# Test assign roles
curl -X POST https://your-domain/api/assign-roles \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "test_room",
    "playerIds": ["player1", "player2", "player3", "player4"],
    "gameSettings": {
      "mafiaCount": 1,
      "doctorCount": 1,
      "detectiveCount": 1
    }
  }'
```

## 🐛 Troubleshooting

### Check Logs
```bash
docker-compose logs -f
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild Containers
```bash
docker-compose down
docker-compose up -d --build
```

### Check SSL Certificates
```bash
openssl x509 -in nginx/ssl/cert.pem -text -noout
```

## 📊 Monitoring

### Health Check
```bash
curl -f https://your-domain/health
```

### Container Status
```bash
docker-compose ps
```

### Resource Usage
```bash
docker stats
```

## 🔧 Customization

### Add Redis for Caching
Uncomment Redis service in `docker-compose.yml` and update `server.js` to use Redis.

### Add Database
Replace Appwrite with PostgreSQL/MySQL by updating `server.js` and adding database service.

### Add Monitoring
Add Prometheus/Grafana containers for advanced monitoring.

## 📝 License

This project is part of the Mafia Game Flutter application. 