const axios = require('axios');
const {
  Guild, Channel, Client, User,
} = require('discord.js');
const commands = require('./points');
const { generateLeaderData } = require('./mockData');

axios.post = jest.fn();

const mockSend = jest.fn();
mockSend.mockImplementation((message) => message);

jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation((users, channel, user) => ({
    channels: {
      cache: {
        get: () => channel,
      },
    },
    users: {
      cache: {
        get: (userId) => users.filter((filteredUser) => `<@${userId}>` === filteredUser.id)[0],
      },
    },
    user,
  })),

  Guild: jest.fn().mockImplementation((users) => ({
    members: {
      members: users,
      cache: {
        get: (id) => users.filter((member) => member.discord_id === id)[0],
      },
    },
    roles: {
      cache: [{ name: 'club-40' }],
    },
    member: (user) => users.filter((member) => member === user)[0],
  })),

  Channel: jest.fn().mockImplementation((id) => ({
    id,
    send: mockSend,
  })),

  User: jest.fn().mockImplementation((roles, id, points) => ({
    roles: {
      add: () => {
        roles.push('club-40');
      },
      cache: roles,
    },
    id: `<@${id}>`,
    points,
    toString: () => `<@${id}>`,
  })),
}));

beforeEach(() => {
  axios.post.mockClear();
  mockSend.mockClear();
  User.mockClear();
});

describe('award points', () => {
  describe('regex ++', () => {
    it.each([
      ['<@!123456789> ++'],
      ['<@!123456789> +++'],
      ['<@!123456789> ++++++++++++'],
      ['thanks <@!123456789> ++'],
    ])("%s' - triggers the callback", (string) => {
      expect(string.match(commands.awardPoints.regex)).toBeTruthy();
    });

    it.each([
      ['++'],
      [''],
      [' '],
      [' /'],
      ['odin-bot++'],
      ['/++'],
      ['```function("<@!123456789> ++", () => {}```'],
    ])("'%s' does not trigger the callback", (string) => {
      expect(string.match(commands.awardPoints.regex)).toBeFalsy();
    });

    it.each([
      ['Check this out! <@!123456789> ++'],
      ["Don't worry about it <@!123456789> ++"],
      ['Hey <@!123456789> ++'],
      ['/ <@!123456789> ++ ^ /me /leaderboard /tests$*'],
    ])("'%s' - command can be anywhere in the string", (string) => {
      expect(string.match(commands.awardPoints.regex)).toBeTruthy();
    });

    it.each([
      ['@user/ ++'],
      ["it's about/<@!123456789> ++"],
      ['<@!123456789> ++isanillusion'],
      ['<@!123456789> ++/'],
      ['<@!123456789> ++*'],
      ['<@!123456789> ++...'],
    ])(
      "'%s' - command should be its own word/group - no leading or trailing characters",
      (string) => {
        expect(string.match(commands.awardPoints.regex)).toBeFalsy();
      },
    );
  });

  describe('regex ⭐', () => {
    it.each([['<@!123456789> ⭐'], ['thanks <@!123456789> ⭐']])(
      "'%s' - correct strings trigger the callback",
      (string) => {
        expect(string.match(commands.awardPoints.regex)).toBeTruthy();
      },
    );

    it.each([
      ['⭐'],
      [''],
      [' '],
      [' /'],
      ['odin-bot⭐'],
      ['/⭐'],
      ['```function("<@!123456789> ⭐", () => {}```'],
    ])("'%s' does not trigger the callback", (string) => {
      expect(string.match(commands.awardPoints.regex)).toBeFalsy();
    });

    it.each([
      ['Check this out! <@!123456789> ⭐'],
      ["Don't worry about it <@!123456789> ⭐"],
      ['Hey <@!123456789> ⭐'],
      ['/ <@!123456789> ⭐ ^ /me /leaderboard /tests$*'],
    ])("'%s' - command can be anywhere in the string", (string) => {
      expect(string.match(commands.awardPoints.regex)).toBeTruthy();
    });

    it.each([
      ['@user/++'],
      ["it's about/<@!123456789> ⭐"],
      ['<@!123456789> ⭐isanillusion'],
      ['<@!123456789> ⭐/'],
      ['<@!123456789> ⭐*'],
      ['<@!123456789> ⭐...'],
    ])(
      "'%s' - command should be its own word/group - no leading or trailing characters",
      (string) => {
        expect(string.match(commands.awardPoints.regex)).toBeFalsy();
      },
    );
  });

  describe('callback', () => {
    const author = User([], 1, 10);
    const channel = Channel();

    it('returns correct output for a single user w/o club-40', async () => {
      const mentionedUser = User([], 2, 20);
      // users must be passed in as an array
      const client = Client([author, mentionedUser], channel);
      const data = {
        author,
        content: `${mentionedUser.id} ++`,
        channel,
        client,
        guild: Guild([author, mentionedUser]),
      };

      axios.post.mockResolvedValue({
        data: {
          ...mentionedUser,
          points: (mentionedUser.points += 1),
        },
      });

      await commands.awardPoints.cb(data);
      expect(data.channel.send).toHaveBeenCalled();
      expect(data.channel.send.mock.calls[0][0]).toMatchSnapshot();
    });

    it('returns correct output for a single user entering club-40', async () => {
      const mentionedUser = User([], 2, 39);
      const client = Client([author, mentionedUser], channel);
      const data = {
        author,
        content: `${mentionedUser.id} ++`,
        channel,
        client,
        guild: Guild([author, mentionedUser]),
      };

      axios.post.mockResolvedValue({
        data: {
          ...mentionedUser,
          points: (mentionedUser.points += 1),
        },
      });

      await commands.awardPoints.cb(data);
      expect(data.channel.send).toHaveBeenCalled();
      expect(data.channel.send.mock.calls[0][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[1][0]).toMatchSnapshot();
    });

    it('returns correct output for up to five mentioned users', async () => {
      const mentionedUser1 = User([], 2, 33);
      const mentionedUser2 = User([], 2, 21);
      const mentionedUser3 = User([], 2, 2);
      const mentionedUser4 = User([], 2, 0);
      const client = Client(
        [
          author,
          mentionedUser1,
          mentionedUser2,
          mentionedUser3,
          mentionedUser4,
        ],
        channel,
      );

      const data = {
        author,
        content: `${mentionedUser1.id} ++ ${mentionedUser2.id} ++ ${mentionedUser3.id} ++ ${mentionedUser4.id} ++`,
        channel,
        client,
        guild: Guild([
          author,
          mentionedUser1,
          mentionedUser2,
          mentionedUser3,
          mentionedUser4,
        ]),
      };

      axios.post
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser1,
            points: (mentionedUser1.points += 1),
          },
        })
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser2,
            points: (mentionedUser2.points += 1),
          },
        })
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser3,
            points: (mentionedUser3.points += 1),
          },
        })
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser4,
            points: (mentionedUser4.points += 1),
          },
        });

      await commands.awardPoints.cb(data);
      expect(data.channel.send).toHaveBeenCalledTimes(4);
      expect(data.channel.send.mock.calls[0][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[1][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[2][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[3][0]).toMatchSnapshot();
    });

    it('returns correct output for more than five mentioned users', async () => {
      const mentionedUser1 = User([], 2, 10);
      const mentionedUser2 = User([], 2, 3);
      const mentionedUser3 = User([], 2, 1);
      const mentionedUser4 = User([], 2, 0);
      const mentionedUser5 = User([], 2, 21);
      const client = Client(
        [
          author,
          mentionedUser1,
          mentionedUser2,
          mentionedUser3,
          mentionedUser4,
          mentionedUser5,
        ],
        channel,
      );

      const data = {
        author,
        content: `${mentionedUser1.id} ++ ${mentionedUser2.id} ++ ${mentionedUser3.id} ++ ${mentionedUser4.id} ++ ${mentionedUser5.id} ++`,
        channel,
        client,
        guild: Guild([
          author,
          mentionedUser1,
          mentionedUser2,
          mentionedUser3,
          mentionedUser4,
          mentionedUser5,
        ]),
      };

      axios.post
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser1,
            points: (mentionedUser1.points += 1),
          },
        })
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser2,
            points: (mentionedUser2.points += 1),
          },
        })
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser3,
            points: (mentionedUser3.points += 1),
          },
        })
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser4,
            points: (mentionedUser4.points += 1),
          },
        })
        .mockResolvedValueOnce({
          data: {
            ...mentionedUser5,
            points: (mentionedUser5.points += 1),
          },
        });

      await commands.awardPoints.cb(data);
      expect(data.channel.send).toHaveBeenCalledTimes(6);
      expect(data.channel.send.mock.calls[0][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[1][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[2][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[3][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[4][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[5][0]).toMatchSnapshot();
    });

    it('returns correct output for a user mentioning themselves', async () => {
      const client = Client([author], channel);
      const data = {
        author,
        content: `${author.id} ++`,
        channel,
        client,
        guild: Guild([author]),
      };

      axios.post.mockResolvedValue({
        data: {
          ...author,
          points: (author.points += 1),
        },
      });

      await commands.awardPoints.cb(data);
      expect(data.channel.send).toHaveBeenCalled();
      expect(data.channel.send.mock.calls[0][0]).toMatchSnapshot();
      expect(data.channel.send.mock.calls[1][0]).toMatchSnapshot();
    });

    it('returns correct output for a user mentioning Odin Bot', async () => {
      const odinBot = User([], 0, 0);
      const client = Client([author, odinBot], channel, odinBot);
      const data = {
        author,
        content: `${odinBot.id} ++`,
        channel,
        client,
        guild: Guild([author]),
      };

      await commands.awardPoints.cb(data);
      expect(data.channel.send).toHaveBeenCalled();
      expect(data.channel.send.mock.calls[0][0]).toMatchSnapshot();
    });

    it('returns correct output for a user awarding points in a channel listed in the config file', async () => {
      jest.mock(
        '../config',
        () => ({
          noPointsChannels: ['513125912070455296', '123456789'],
        }),
        { virtual: true },
      );
      const mentionedUser = User([], 2, 20);
      const botSpamChannel = Channel('513125912070455296');
      const bannedChannel = Channel('123456789');
      const client = Client([author, mentionedUser], botSpamChannel);

      const botSpamChannelData = {
        author,
        content: `${mentionedUser.id} ++`,
        channel: botSpamChannel,
        client,
        guild: Guild([author, mentionedUser]),
      };

      const bannedChannelData = {
        author,
        content: `${mentionedUser.id} ++`,
        channel: bannedChannel,
        client,
        guild: Guild([author, mentionedUser]),
      };

      await commands.awardPoints.cb(botSpamChannelData);
      expect(botSpamChannelData.channel.send).toHaveBeenCalled();
      expect(
        botSpamChannelData.channel.send.mock.calls[0][0],
      ).toMatchSnapshot();

      await commands.awardPoints.cb(bannedChannelData);
      expect(bannedChannelData.channel.send).toHaveBeenCalled();
      expect(bannedChannelData.channel.send.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});

describe('@user --', () => {
  describe('regex', () => {
    it.each([
      ['<@!123456789> --'],
      ['thanks <@!123456789> --'],
      ['<@!123456789>--'],
    ])('correct strings trigger the callback', (string) => {
      expect(commands.deductPoints.regex.test(string)).toBeTruthy();
    });
    it.each([
      ['--'],
      [''],
      [' '],
      [' /'],
      ['odin-bot--'],
      ['/--'],
      ['```function("<@!123456789> --", () => {}```'],
    ])("'%s' does not trigger the callback", (string) => {
      expect(commands.deductPoints.regex.test(string)).toBeFalsy();
    });

    it.each([
      ['Check this out! <@!123456789> --'],
      ["Don't worry about it <@!123456789> --"],
      ['Hey <@!123456789> --'],
      ['/ <@!123456789>-- ^ /me /leaderboard /tests$*'],
    ])("'%s' - command can be anywhere in the string", (string) => {
      expect(commands.deductPoints.regex.test(string)).toBeTruthy();
    });

    it.each([
      ['@user/--'],
      ["it's about/<@!123456789>--"],
      ['<@!123456789>--isanillusion'],
      ['<@!123456789>--/'],
      ['<@!123456789>--*'],
      ['<@!123456789>--...'],
    ])(
      "'%s' - command should be its own word/group - no leading or trailing characters",
      (string) => {
        expect(commands.deductPoints.regex.test(string)).toBeFalsy();
      },
    );
  });

  describe('callback', () => {
    it('returns correct output', async () => {
      expect(commands.deductPoints.cb()).toMatchSnapshot();
    });
  });
});

describe('/points', () => {
  describe('regex', () => {
    it.each([
      ['/points <@!123456789>'],
      ['let me check out my /points <@!123456789>'],
      ['/points <@!123456789> <@!123456789>-v2'],
      ['/points'],
    ])('correct strings trigger the callback', (string) => {
      expect(commands.points.regex.test(string)).toBeTruthy();
    });
  });
});

describe('/leaderboard', () => {
  describe('regex', () => {
    it.each([
      ['/leaderboard'],
      ['<@!123456789> /leaderboard'],
      ['/leaderboard n=10 start=30'],
      ['/leaderboard n=20 start=50'],
      ['/leaderboard n=10'],
      ['/leaderboard start=30'],
    ])('correct strings trigger the callback', (string) => {
      expect(commands.leaderboard.regex.test(string)).toBeTruthy();
    });

    it.each([
      ['/leaderboad'],
      [''],
      [' '],
      [' /'],
      ['/lead'],
      ['leaderboard'],
      ['/le'],
      ['/leaderboards'],
      ['```function("/leaderboard", () => {}```'],
      ['/leader'],
      ['<@!123456789> / leaderboard'],
      ['<@!123456789> /leaderbard'],
      ['/leaderbord n=10 start=30'],
    ])("'%s' does not trigger the callback", (string) => {
      expect(commands.leaderboard.regex.test(string)).toBeFalsy();
    });

    it.each([
      ['Check this out! /leaderboard'],
      ["Don't worry about /leaderboard"],
      ['Hey <@!123456789>, /leaderboard'],
      ['/<@!123456789> ^ /me /leaderboard /tests$*'],
    ])("'%s' - command can be anywhere in the string", (string) => {
      expect(commands.leaderboard.regex.test(string)).toBeTruthy();
    });

    it.each([
      ['@user/leaderboard'],
      ["it's about/leaderboard"],
      ['/leaderboardisanillusion'],
      ['/leaderboard/'],
      ['/leaderboard*'],
      ['/leaderboard...'],
    ])(
      "'%s' - command should be its own word/group - no leading or trailing characters",
      (string) => {
        expect(commands.leaderboard.regex.test(string)).toBeFalsy();
      },
    );
  });

  describe('callback', () => {
    it('returns correct output', async () => {
      const members = generateLeaderData(5);

      axios.get = jest.fn();
      axios.get.mockResolvedValue({
        data: members,
      });

      expect(
        await commands.leaderboard.cb({
          guild: Guild(members),
          content: '/leaderboard n=5 start=1',
        }),
      ).toMatchSnapshot();
      expect(
        await commands.leaderboard.cb({
          guild: Guild(members),
          content: '/leaderboard n=3 start=1',
        }),
      ).toMatchSnapshot();
      expect(
        await commands.leaderboard.cb({
          guild: Guild(members),
          content: '/leaderboard n=2 start=3',
        }),
      ).toMatchSnapshot();
      expect(
        await commands.leaderboard.cb({
          guild: Guild(members),
          content: '/leaderboard start=3',
        }),
      ).toMatchSnapshot();
      expect(
        await commands.leaderboard.cb({
          guild: Guild(members),
          content: '/leaderboard n=2',
        }),
      ).toMatchSnapshot();
      expect(
        await commands.leaderboard.cb({
          guild: Guild(members),
          content: '/leaderboard n=2 start=wtf',
        }),
      ).toMatchSnapshot();
      expect(
        await commands.leaderboard.cb({
          guild: Guild(members),
          content: '/leaderboard n=wtf start=3',
        }),
      ).toMatchSnapshot();
      expect(
        await commands.leaderboard.cb({
          guild: Guild(members),
          content: '/leaderboard n=25 start=9999',
        }),
      ).toMatchSnapshot();
    });
  });
});
