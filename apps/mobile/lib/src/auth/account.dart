class Account {
  const Account({required this.id, required this.email, required this.displayName, required this.role, required this.status});
  final String id;
  final String email;
  final String displayName;
  final String role;
  final String status;

  factory Account.fromJson(Map<String, dynamic> json) => Account(
        id: json['id'] as String,
        email: json['email'] as String,
        displayName: json['displayName'] as String,
        role: json['role'] as String,
        status: json['status'] as String,
      );
}

class AuthTokens {
  const AuthTokens({required this.accessToken, required this.refreshToken});
  final String accessToken;
  final String refreshToken;
}

class AuthResult {
  const AuthResult({required this.account, required this.tokens});
  final Account account;
  final AuthTokens tokens;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        account: Account.fromJson(json['user'] as Map<String, dynamic>),
        tokens: AuthTokens(
          accessToken: json['accessToken'] as String,
          refreshToken: json['refreshToken'] as String,
        ),
      );
}
