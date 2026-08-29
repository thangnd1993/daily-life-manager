class AppConfig {
  const AppConfig._();
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000/api');
  static const timezone = String.fromEnvironment('TIMEZONE', defaultValue: 'Asia/Ho_Chi_Minh');
}
