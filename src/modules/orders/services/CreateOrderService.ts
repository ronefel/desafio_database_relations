import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (!findProducts.length) {
      throw new AppError('Could not find any products with the given ids');
    }

    const existentProductIds = findProducts.map(product => product.id);

    products.forEach(product => {
      if (!existentProductIds.includes(product.id)) {
        throw new AppError(`Could not find product ${product.id}`);
      }
    });

    // const checkInexistentProducts = products.filter(
    //   product => !existentProductIds.includes(product.id),
    // );

    // if (checkInexistentProducts.length) {
    //   throw new AppError(
    //     `Could not find product${checkInexistentProducts[0].id}`,
    //   );
    // }

    findProducts.forEach(findProduct => {
      products.forEach(product => {
        if (
          findProduct.id === product.id &&
          findProduct.quantity < product.quantity
        ) {
          throw new AppError(
            `The ${findProduct.name} product is insufficient quantity`,
          );
        }
      });
    });

    // const findLowProductQuantity = products.filter(
    //   product =>
    //     findProducts.filter(p => p.id === product.id)[0].quantity <
    //     product.quantity,
    // );

    // if (findLowProductQuantity) {
    //   throw new AppError(
    //     `The ${findLowProductQuantity[0].id} with insufficient quantity`,
    //   );
    // }

    const ordersProducts = products.map(product => ({
      product_id: product.id,
      price: findProducts.filter(p => p.id === product.id)[0].price,
      quantity: product.quantity,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: ordersProducts,
    });

    const { order_products } = order;

    const productsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        findProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(productsQuantity);

    return order;
  }
}

export default CreateOrderService;
