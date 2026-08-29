import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListUsersQueryDto } from './admin-users.dto';

describe('ListUsersQueryDto', () => {
  it('rejects arbitrary sort fields and excessive page sizes', async () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      sortBy: 'passwordHash',
      pageSize: 1000,
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['sortBy', 'pageSize']),
    );
  });
});
