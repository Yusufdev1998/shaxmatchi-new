import { Injectable } from "@nestjs/common";

type DebutLevelItem = {
  title: string;
  points: string;
  to?: string;
};

type DebutLevel = {
  title: string;
  items: DebutLevelItem[];
};

@Injectable()
export class AppService {
  getHello() {
    return { message: "Hello from backend" };
  }

  getHealth() {
    return { ok: true, service: "backend" };
  }

  getDebutLevels(): { levels: DebutLevel[] } {
    return {
      levels: [
        {
          title: "Базовая подготовка",
          items: [
            { title: "Дебюты 3-2 разряд", points: "Очки 0 из 213", to: "/course/41" },
            { title: "d2-d4 белыми", points: "Очки 0 из 573" }
          ]
        },
        {
          title: "Для продолжающих",
          items: [
            { title: "Голландская защита", points: "Очки 0 из 135" },
            { title: "Славянская защита", points: "Очки 0 из 468" },
            { title: "Защита Каро-Канн", points: "Очки 0 из 219" },
            { title: "Центральный дебют", points: "Очки 0 из 81" },
            { title: "Русская партия", points: "Очки 0 из 60" },
            { title: "Волжский гамбит", points: "Очки 0 из 135" },
            { title: "Будапештский гамбит", points: "Очки 0 из 87" },
            { title: "Защита Нимцовича", points: "Очки 0 из 117" },
            { title: "Защита Грюнфельда", points: "Очки 0 из 156" },
            { title: "Лондонская система", points: "Очки 0 из 99" },
            { title: "Сицилианская защита", points: "Очки 0 из 219" },
            { title: "Староиндийская защита", points: "Очки 0 из 282" },
            { title: "Французская защита", points: "Очки 0 из 54" },
            { title: "Защита Филидора", points: "Очки 0 из 93" },
            { title: "Скандинавская защита", points: "Очки 0 из 63" },
            { title: "Испанская партия", points: "Очки 0 из 288" },
            { title: "Итальянская партия", points: "Очки 0 из 60" },
            { title: "Шотландская партия", points: "Очки 0 из 81" },
            { title: "Ферзевый гамбит", points: "Очки 0 из 150" },
            { title: "Венская партия", points: "Очки 0 из 60" },
            { title: "Королевский гамбит", points: "Очки 0 из 99" },
            { title: "Северный гамбит", points: "Очки 0 из 36" },
            { title: "Защита Пирца-Уфимцева", points: "Очки 0 из 120" }
          ]
        }
      ]
    };
  }
}

