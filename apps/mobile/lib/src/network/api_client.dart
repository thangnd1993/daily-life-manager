import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  Future<http.Response> get(String path) => _client.get(Uri.parse('${AppConfig.apiUrl}/$path'));
  void close() => _client.close();
}
