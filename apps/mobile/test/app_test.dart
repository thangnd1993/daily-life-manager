import 'package:daily_life_manager/src/app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders the foundation home screen', (tester) async {
    await tester.pumpWidget(const DailyLifeManagerApp());
    expect(find.text('Daily Life Manager'), findsOneWidget);
  });
}
