# 🚀 VPS Deployment Guide

This guide will help you deploy the Mafia Game backend to your VPS using Docker Compose.

## 📋 Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: Minimum 1GB (2GB recommended)
- **Storage**: 10GB+ free space
- **Network**: Public IP address

### Software Requirements
- Docker
- Docker Compose
- Git

## 🔧 Step 1: VPS Setup

### Install Docker
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes
exit
# SSH back to your VPS
```

### Configure Firewall
```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Enable firewall
sudo ufw enable
```

## 📦 Step 2: Deploy Backend

### Clone Repository
```bash
# Clone to your VPS
git clone <your-repo-url> mafia_backend
cd mafia_backend
```

### Configure Environment
```bash
# Copy environment template
cp env.example .env

# Edit with your Appwrite API key
nano .env
```

**Edit `.env` file:**
```env
# Backend Configuration
PORT=3000
NODE_ENV=production

# Appwrite Configuration
APPWRITE_ENDPOINT=https://appwrite.p1ng.me/v1
APPWRITE_PROJECT_ID=68837172000c488faf55
APPWRITE_API_KEY=your_actual_api_key_here
```

### Run Deployment
```bash
# Make scripts executable
chmod +x scripts/deploy.sh scripts/setup-ssl.sh

# Run deployment
./scripts/deploy.sh
```

## 🌐 Step 3: Domain Setup (Optional)

### Configure Domain
1. **Point your domain** to your VPS IP address
2. **Update nginx configuration**:
   ```bash
   nano nginx/nginx.conf
   ```
   Change `server_name _;` to `server_name your-domain.com;`

### SSL Certificates (Production)
```bash
# Install certbot
sudo apt install certbot

# Get certificates
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# Restart services
docker-compose restart
```

## 🧪 Step 4: Testing

### Test Health Endpoint
```bash
# Test locally
curl http://localhost/health

# Test with domain (if configured)
curl https://your-domain.com/health
```

### Test Game Logic
```bash
# Test assign roles
curl -X POST https://your-domain.com/api/assign-roles \
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

## 🔄 Step 5: Update Flutter App

Update your Flutter app's `database_service.dart` to use the new backend:

```dart
import 'package:http/http.dart' as http;

class DatabaseService {
  static const String _backendUrl = 'https://your-domain.com';
  
  Future<GameStateV2?> startGameForRoom(String roomId, List<String> playerIds, GameSettings gameSettings) async {
    try {
      final response = await http.post(
        Uri.parse('$_backendUrl/api/assign-roles'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'roomId': roomId,
          'playerIds': playerIds,
          'gameSettings': gameSettings.toJson(),
        }),
      );

      final responseData = jsonDecode(response.body);
      
      if (responseData['success'] == true) {
        final gameStateId = responseData['gameStateId'];
        
        // Fetch the created game state from Appwrite
        final gameStateDoc = await databases.getDocument(
          databaseId: 'mafia_game_db',
          collectionId: 'game_states',
          documentId: gameStateId,
        );
        
        return GameStateV2.fromJson(gameStateDoc.data);
      } else {
        throw Exception(responseData['error'] ?? 'Failed to start game');
      }
    } catch (e) {
      print('Error starting game: $e');
      rethrow;
    }
  }
}
```

## 🛠️ Management Commands

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

### Stop Services
```bash
docker-compose down
```

### Check Status
```bash
docker-compose ps
```

## 🔒 Security Notes

- **API Key**: Keep your Appwrite API key secure
- **Firewall**: Only expose ports 80 and 443
- **SSL**: Use Let's Encrypt for production
- **Updates**: Regularly update Docker images and system packages

## 🐛 Troubleshooting

### Services Not Starting
```bash
# Check logs
docker-compose logs

# Check container status
docker-compose ps

# Rebuild containers
docker-compose down
docker-compose up -d --build
```

### SSL Issues
```bash
# Check certificate validity
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Regenerate self-signed certificates
./scripts/setup-ssl.sh
```

### Network Issues
```bash
# Check if ports are open
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Check firewall
sudo ufw status
```

## 📊 Monitoring

### Health Check
```bash
curl -f https://your-domain.com/health
```

### Resource Usage
```bash
docker stats
```

### System Resources
```bash
htop
df -h
free -h
```

## 🎉 Success!

Your Mafia Game backend is now running on your VPS! 

**Next Steps:**
1. Test all endpoints
2. Update your Flutter app
3. Configure monitoring (optional)
4. Set up automatic backups (optional)

**API Endpoints:**
- `https://your-domain.com/health`
- `https://your-domain.com/api/assign-roles`
- `https://your-domain.com/api/process-night-actions`
- `https://your-domain.com/api/process-voting` 