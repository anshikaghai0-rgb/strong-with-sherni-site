// All challenge content lives here. To add a new challenge later, copy the
// 'sugar-break' block, change the id/name/tasks, and it will work in the app.
// VIDEOS: add  video: 'https://youtu.be/XXXX'  (or an .mp4 link) to any day below
// and it will show inside that day's task card automatically.
window.SWS_CHALLENGES = {
  'sugar-break': {
    id: 'sugar-break',
    name: 'Sugar Break',
    tagline: '21 days. Zero added sugar.',
    days: 21,
    checkinQuestion: 'Were you sugar-free today?',
    yesLabel: 'Yes, sugar-free',
    noLabel: 'I slipped',
    rules: {
      no: [
        'White or brown sugar in tea, coffee or food',
        'Jaggery, honey, syrups and "natural" sweeteners',
        'Mithai, desserts, chocolates, ice cream',
        'Biscuits, cakes, pastries, sweet breads',
        'Cold drinks, packaged juices, energy drinks',
        'Flavoured yogurt, sweetened cereal, ketchup and sweet sauces'
      ],
      yes: [
        'Whole fruits (1-2 servings a day)',
        'Plain milk, curd, paneer, buttermilk',
        'Dal, sabzi, roti, rice, eggs, chicken, fish',
        'Nuts, seeds, roasted chana, makhana',
        'Water, plain nimbu pani, unsweetened tea or coffee'
      ]
    },
    weeks: [
      { n: 1, title: 'Break', sub: 'Days 1-7 · The hardest week. Cravings peak, then start to fade.' },
      { n: 2, title: 'Rebuild', sub: 'Days 8-14 · Your taste buds reset. Food starts tasting sweeter.' },
      { n: 3, title: 'Own it', sub: 'Days 15-21 · Make sugar-free feel normal, even at parties.' }
    ],
    tasks: [
      { day: 1,  title: 'Clear the kitchen', task: 'Remove or hide all sweets, biscuits and sugary drinks at home. Out of sight, out of mind.', tip: 'Tell your family you\'re doing this challenge, so they can support you.' },
      { day: 2,  title: 'Protein breakfast', task: 'Start the day with protein: eggs, paneer, curd, dal chilla or sprouts.', tip: 'A protein breakfast keeps blood sugar steady and cuts cravings later in the day.' },
      { day: 3,  title: 'Plain chai day', task: 'Have your tea or coffee with zero sugar. Add cinnamon or elaichi for flavour.', tip: 'It tastes strange for 3-4 days. After that, sweet chai will taste too sweet.' },
      { day: 4,  title: 'Plan the 4 PM snack', task: 'Keep a sugar-free snack ready: fruit with nuts, roasted chana or makhana.', tip: 'Most sugar slips happen when you are hungry and unprepared.' },
      { day: 5,  title: 'Water first', task: 'Drink 3 litres of water today. When a craving hits, drink a glass first.', tip: 'Thirst often feels like a sugar craving.' },
      { day: 6,  title: 'Label detective', task: 'Read the labels of 3 packaged foods at home. Look for sugar, glucose, maltodextrin, syrup.', tip: 'Sugar hides under more than 50 different names.' },
      { day: 7,  title: 'Week 1 check-in', task: 'Write down how your cravings, sleep and energy feel compared to Day 1.', tip: 'You just finished the hardest week. Be proud of that.' },
      { day: 8,  title: 'Sleep 7+ hours', task: 'Get to bed early tonight. Aim for 7-8 hours of sleep.', tip: 'Poor sleep increases hunger hormones and sugar cravings the next day.' },
      { day: 9,  title: 'Fibre at every meal', task: 'Add salad, sabzi or dal to every meal today.', tip: 'Fibre slows digestion and keeps you full for longer.' },
      { day: 10, title: 'Craving rescue', task: 'When a craving comes, wait 10 minutes, drink water and take a short walk. Then decide.', tip: 'Most cravings pass in 10-15 minutes if you don\'t feed them.' },
      { day: 11, title: 'Move after meals', task: 'Take a 10-minute walk after lunch or dinner.', tip: 'A short walk after eating helps your body manage blood sugar better.' },
      { day: 12, title: 'Sugar-free dessert', task: 'Make a sugar-free sweet: fruit with cinnamon, chia pudding with fruit, or curd with berries.', tip: 'Fruit tastes much sweeter now that your taste buds are resetting.' },
      { day: 13, title: 'Eat out smart', task: 'If you eat out or order in, skip the sweet drink and dessert. Choose protein + veggies.', tip: 'Say "no sugar please" when you order chai, lassi or nimbu pani.' },
      { day: 14, title: 'Week 2 check-in', task: 'Notice your energy at 4 PM, your skin and your bloating. What changed?', tip: 'Two weeks done. Your body is already thanking you.' },
      { day: 15, title: 'Your 3 favourite swaps', task: 'Write down the 3 swaps that worked best for you so far.', tip: 'These swaps are your toolkit for life after the challenge.' },
      { day: 16, title: 'Stress without sugar', task: 'When stressed, try 5 deep breaths, a walk or calling a friend instead of reaching for sweets.', tip: 'We often eat sugar for comfort, not hunger.' },
      { day: 17, title: 'Party plan', task: 'Plan how you\'ll handle the next party, festival or office treat. Decide in advance.', tip: 'Eat a protein snack before you go, and hold a glass of water in your hand.' },
      { day: 18, title: 'Sugar-free cooking', task: 'Cook one meal at home with no hidden sugar. Check sauces and masalas.', tip: 'Many ready-made sauces and gravies have added sugar.' },
      { day: 19, title: 'Learn to say no', task: 'Practise one polite line: "No thanks, I\'m off sugar right now."', tip: 'Saying it confidently makes people stop pushing.' },
      { day: 20, title: 'Share your win', task: 'Share your biggest win from this challenge in the WhatsApp group.', tip: 'Your story might inspire someone else in your batch.' },
      { day: 21, title: 'Your sugar rule', task: 'Write your own sugar rule for the next month, e.g. "Sweets only on Sundays".', tip: 'You did 21 days with zero added sugar. That\'s huge. Celebrate (without cake)!' }
    ],
    sos: [
      'Drink a big glass of water and wait 10 minutes.',
      'Eat something with protein: a boiled egg, a handful of nuts, paneer or curd.',
      'Have a piece of fruit with 4-5 almonds.',
      'Go for a 5-minute walk or do 10 squats.',
      'Brush your teeth. Sweet cravings drop right after.',
      'Chew on saunf, elaichi or a clove.',
      'Message the WhatsApp group: "Craving alert!" Your batch will cheer you on.'
    ]
  }
};
